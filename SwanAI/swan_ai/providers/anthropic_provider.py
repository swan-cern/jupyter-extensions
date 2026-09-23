"""Anthropic (Claude) provider, on top of the official `anthropic` SDK."""

from __future__ import annotations

from collections.abc import AsyncIterator

import anthropic

from swan_ai.providers.base import ChatEvent, ChatMessage, ChatProvider

# Offered when the provider cannot be queried (no network, restricted key). Kept short on
# purpose: `list_models` asks the API for the real list whenever it can.
FALLBACK_MODELS = [
    "claude-opus-5",
    "claude-sonnet-5",
    "claude-haiku-4-5",
]


class AnthropicProvider(ChatProvider):
    name = "anthropic"
    default_model = "claude-opus-5"
    fallback_models = FALLBACK_MODELS

    def _client(self) -> anthropic.AsyncAnthropic:
        return anthropic.AsyncAnthropic(api_key=self._api_key)

    async def list_models(self) -> list[str]:
        try:
            async with self._client() as client:
                page = await client.models.list(limit=50)
                advertised = [model.id for model in page.data]
        except anthropic.AnthropicError:
            advertised = []
        return self.allowed_models(advertised) or self.allowed_models(FALLBACK_MODELS)

    async def stream(
        self,
        messages: list[ChatMessage],
        *,
        model: str,
        system: str,
        max_tokens: int,
    ) -> AsyncIterator[ChatEvent]:
        yield {"type": "start", "model": model}

        try:
            # Adaptive thinking lets the model decide how much to reason; `display` is what
            # makes the summary visible, since it is omitted by default on current models.
            # `budget_tokens` and `temperature` are rejected by this model family.
            async with (
                self._client() as client,
                client.messages.stream(
                    model=model,
                    max_tokens=max_tokens,
                    system=system,
                    messages=messages,
                    thinking={"type": "adaptive", "display": "summarized"},
                    output_config={"effort": self._config.effort},
                ) as stream,
            ):
                async for event in stream:
                    translated = _translate(event)
                    if translated is not None:
                        yield translated

                final = await stream.get_final_message()

            usage = getattr(final, "usage", None)
            if usage is not None:
                yield {
                    "type": "usage",
                    "input_tokens": getattr(usage, "input_tokens", 0),
                    "output_tokens": getattr(usage, "output_tokens", 0),
                }

            stop_reason = getattr(final, "stop_reason", None)
            if stop_reason == "refusal":
                details = getattr(final, "stop_details", None)
                explanation = getattr(details, "explanation", None)
                yield {
                    "type": "error",
                    "message": explanation or "Claude declined to answer this request.",
                }
                return

            yield {"type": "done", "stop_reason": stop_reason}
        except anthropic.APIError as error:
            yield {"type": "error", "message": _user_message(error)}
        except Exception as error:
            # The panel must show something actionable rather than a stream that just stops.
            yield {"type": "error", "message": f"Unexpected error talking to Anthropic: {error}"}


def _translate(event: object) -> ChatEvent | None:
    """Map one SDK stream event onto our vocabulary, ignoring the ones we do not surface."""
    event_type = getattr(event, "type", None)

    if event_type == "text":
        return {"type": "delta", "text": event.text}
    if event_type == "thinking":
        return {"type": "thinking", "text": getattr(event, "thinking", "")}
    return None


# Most specific first: the SDK exception classes overlap.
ERROR_MESSAGES: tuple[tuple[type[Exception], str], ...] = (
    (anthropic.AuthenticationError, "Anthropic rejected the API key. Check it in the SwanAI settings."),
    (anthropic.PermissionDeniedError, "This Anthropic API key is not allowed to use this model."),
    (anthropic.NotFoundError, "Anthropic does not know this model. Pick another one."),
    (anthropic.RateLimitError, "Anthropic rate limit reached. Wait a moment and try again."),
    (
        anthropic.APIConnectionError,
        "Could not reach the Anthropic API from this session. Check the network access of your SWAN session.",
    ),
)

SERVER_ERROR_STATUS = 500


def _user_message(error: anthropic.APIError) -> str:
    """Phrase an SDK error for the chat panel, without leaking the key or a traceback."""
    for error_class, message in ERROR_MESSAGES:
        if isinstance(error, error_class):
            return message

    if isinstance(error, anthropic.APIStatusError):
        if error.status_code >= SERVER_ERROR_STATUS:
            return f"Anthropic returned a server error ({error.status_code}). Try again shortly."
        return f"Anthropic rejected the request: {error.message}"

    return f"Anthropic request failed: {error}"
