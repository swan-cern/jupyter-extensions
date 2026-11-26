"""OpenAI provider, on top of the official `openai` SDK.

Uses the Chat Completions shape, which is also what OpenAI-compatible gateways speak, so the
same class works against a self-hosted endpoint by setting `OPENAI_BASE_URL`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import openai

from swan_ai.providers.base import ChatEvent, ChatMessage, ChatProvider

FALLBACK_MODELS = ["gpt-5", "gpt-5-mini"]

# Model families that answer chat requests. The ids returned by /models also cover embeddings,
# audio, moderation and image models, which would only clutter the picker.
CHAT_MODEL_PREFIXES = ("gpt-", "o1", "o3", "o4", "chatgpt-")
NON_CHAT_MARKERS = ("embedding", "whisper", "tts", "audio", "moderation", "image", "dall-e", "realtime")


class OpenAIProvider(ChatProvider):
    name = "openai"
    default_model = "gpt-5"
    fallback_models = FALLBACK_MODELS

    def _client(self) -> openai.AsyncOpenAI:
        return openai.AsyncOpenAI(api_key=self._api_key)

    async def list_models(self) -> list[str]:
        try:
            async with self._client() as client:
                page = await client.models.list()
                advertised = sorted(model.id for model in page.data if _is_chat_model(model.id))
        except openai.OpenAIError:
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
            async with self._client() as client:
                stream = await client.chat.completions.create(
                    model=model,
                    max_completion_tokens=max_tokens,
                    messages=[{"role": "system", "content": system}, *messages],
                    stream=True,
                    stream_options={"include_usage": True},
                )

                stop_reason = None
                usage = None
                async for chunk in stream:
                    if chunk.usage is not None:
                        usage = chunk.usage
                    for choice in chunk.choices:
                        text = choice.delta.content
                        if text:
                            yield {"type": "delta", "text": text}
                        if choice.finish_reason:
                            stop_reason = choice.finish_reason

            if usage is not None:
                yield {
                    "type": "usage",
                    "input_tokens": getattr(usage, "prompt_tokens", 0),
                    "output_tokens": getattr(usage, "completion_tokens", 0),
                }

            yield {"type": "done", "stop_reason": stop_reason}
        except openai.OpenAIError as error:
            yield {"type": "error", "message": _user_message(error)}
        except Exception as error:
            # The panel must show something actionable rather than a stream that just stops.
            yield {"type": "error", "message": f"Unexpected error talking to OpenAI: {error}"}


def _is_chat_model(model_id: str) -> bool:
    lowered = model_id.lower()
    if any(marker in lowered for marker in NON_CHAT_MARKERS):
        return False
    return lowered.startswith(CHAT_MODEL_PREFIXES)


# Most specific first: the SDK exception classes overlap.
ERROR_MESSAGES: tuple[tuple[type[Exception], str], ...] = (
    (openai.AuthenticationError, "OpenAI rejected the API key. Check it in the SwanAI settings."),
    (openai.PermissionDeniedError, "This OpenAI API key is not allowed to use this model."),
    (openai.NotFoundError, "OpenAI does not know this model. Pick another one."),
    (openai.RateLimitError, "OpenAI rate limit or quota reached. Wait a moment and try again."),
    (
        openai.APIConnectionError,
        "Could not reach the OpenAI API from this session. Check the network access of your SWAN session.",
    ),
)

SERVER_ERROR_STATUS = 500


def _user_message(error: openai.OpenAIError) -> str:
    """Phrase an SDK error for the chat panel, without leaking the key or a traceback."""
    for error_class, message in ERROR_MESSAGES:
        if isinstance(error, error_class):
            return message

    if isinstance(error, openai.APIStatusError):
        if error.status_code >= SERVER_ERROR_STATUS:
            return f"OpenAI returned a server error ({error.status_code}). Try again shortly."
        return f"OpenAI rejected the request: {error.message}"

    return f"OpenAI request failed: {error}"
