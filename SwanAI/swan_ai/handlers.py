from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from time import monotonic

import tornado.iostream
import tornado.web
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join

from swan_ai.config import SwanAI
from swan_ai.credentials import CredentialStore
from swan_ai.providers import (
    PROVIDERS,
    ChatEvent,
    ProviderError,
    display_name,
    get_provider,
)

# Sent to the client when the model has produced nothing for a while. SWAN sits behind nginx,
# whose default idle timeout is 60s, and a reasoning model can stay silent for longer than that.
KEEPALIVE_INTERVAL = 5

VALID_ROLES = frozenset({"user", "assistant"})


class SwanAIHandler(APIHandler):
    """Shared access to the extension configuration and the credential store."""

    @property
    def swan_config(self) -> SwanAI:
        return self.settings["swan_ai_config"]

    @property
    def credentials(self) -> CredentialStore:
        return CredentialStore(self.swan_config)

    def write_error_json(self, status: int, message: str) -> None:
        self.set_status(status)
        self.finish(json.dumps({"message": message}))

    def is_known_provider(self, provider: str) -> bool:
        return provider in self.swan_config.enabled_providers and provider in PROVIDERS


class ConfigHandler(SwanAIHandler):
    """Describe what the chat panel can offer. Never returns key material."""

    @tornado.web.authenticated
    async def get(self):
        config = self.swan_config
        status = self.credentials.status()

        providers = []
        for provider in config.enabled_providers:
            provider_class = PROVIDERS.get(provider)
            if provider_class is None:
                continue
            allowlist = config.model_allowlist.get(provider)
            providers.append(
                {
                    "name": provider,
                    "display_name": display_name(provider),
                    "default_model": provider_class.default_model,
                    # A cheap, offline list so the picker works immediately; the panel refreshes
                    # it from the vendor through /models once a key is configured.
                    "models": list(allowlist) if allowlist else list(provider_class.fallback_models),
                    **status.get(provider, {}),
                }
            )

        self.finish(
            json.dumps(
                {
                    "providers": providers,
                    "default_provider": config.default_provider,
                    "default_model": config.default_model,
                    "allow_user_credentials": config.allow_user_credentials,
                    "credentials_path": str(self.credentials.path),
                }
            )
        )


class ModelsHandler(SwanAIHandler):
    """Ask a provider which models it currently offers to the configured key."""

    @tornado.web.authenticated
    async def get(self):
        provider = self.get_query_argument("provider", "")
        if not self.is_known_provider(provider):
            self.write_error_json(400, f"Unknown provider '{provider}'.")
            return

        credential = self.credentials.get(provider)
        if credential is None:
            self.write_error_json(400, f"No API key configured for {display_name(provider)}.")
            return

        try:
            client = get_provider(provider, credential.api_key, self.swan_config)
        except ProviderError as error:
            self.write_error_json(400, str(error))
            return

        models = await client.list_models()
        self.finish(json.dumps({"provider": provider, "models": models}))


class CredentialsHandler(SwanAIHandler):
    """Store or remove one provider's API key in the user's home directory."""

    def _check_editable(self, provider: str) -> bool:
        if not self.swan_config.allow_user_credentials:
            self.write_error_json(403, "API keys are managed centrally in this SWAN session.")
            return False
        if not self.is_known_provider(provider):
            self.write_error_json(400, f"Unknown provider '{provider}'.")
            return False
        return True

    @tornado.web.authenticated
    async def post(self):
        body = self.get_json_body() or {}
        provider = str(body.get("provider", ""))
        api_key = str(body.get("api_key", "")).strip()

        if not self._check_editable(provider):
            return
        if not api_key:
            self.write_error_json(400, "The API key is empty.")
            return

        self.credentials.save(provider, api_key)
        # Deliberately logs the provider only: the key must never reach the logs.
        self.log.info("swan_ai: stored the %s API key", provider)
        self.finish(json.dumps({"provider": provider, **self.credentials.status().get(provider, {})}))

    @tornado.web.authenticated
    async def delete(self):
        provider = self.get_query_argument("provider", "")
        if not self._check_editable(provider):
            return

        self.credentials.delete(provider)
        self.log.info("swan_ai: removed the %s API key", provider)
        self.finish(json.dumps({"provider": provider, **self.credentials.status().get(provider, {})}))


class ChatHandler(SwanAIHandler):
    """Stream one answer as Server-Sent Events.

    The conversation is not kept server-side: the panel sends the history it wants the model to
    see on every request, exactly like the underlying APIs work.
    """

    def initialize(self, **kwargs):
        super().initialize(**kwargs)
        self._disconnected = asyncio.Event()

    def on_connection_close(self) -> None:
        # The user pressed Stop, closed the tab or reloaded. Stop generating: it costs money.
        super().on_connection_close()
        self._disconnected.set()

    @tornado.web.authenticated
    async def post(self):
        config = self.swan_config
        body = self.get_json_body() or {}

        provider_name = str(body.get("provider") or config.default_provider)
        if not self.is_known_provider(provider_name):
            self.write_error_json(400, f"Unknown provider '{provider_name}'.")
            return

        credential = self.credentials.get(provider_name)
        if credential is None:
            self.write_error_json(400, f"No API key configured for {display_name(provider_name)}.")
            return

        try:
            provider = get_provider(provider_name, credential.api_key, config)
            messages = _validate_messages(body.get("messages"), config)
            model = _validate_model(body.get("model"), provider_name, provider.default_model, config)
        except ProviderError as error:
            self.write_error_json(400, str(error))
            return

        self.set_header("Content-Type", "text/event-stream")
        self.set_header("Cache-Control", "no-cache")
        # Without this nginx buffers the whole response and the panel looks frozen.
        self.set_header("X-Accel-Buffering", "no")

        stream = provider.stream(
            messages,
            model=model,
            system=config.system_prompt,
            max_tokens=config.max_tokens,
        )
        await self._pump(stream)
        self.finish()

    async def _pump(self, stream: AsyncIterator[ChatEvent]) -> None:
        """Forward provider events to the client, keeping the connection warm while it waits."""
        queue: asyncio.Queue[ChatEvent | None] = asyncio.Queue()
        producer = asyncio.create_task(_drain(stream, queue))
        last_write = monotonic()

        try:
            while True:
                if self._disconnected.is_set():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=0.5)
                except TimeoutError:
                    if monotonic() - last_write >= KEEPALIVE_INTERVAL:
                        last_write = monotonic()
                        await self._send(": keepalive\n\n")
                    continue

                if event is None:
                    break
                last_write = monotonic()
                await self._send(f"data: {json.dumps(event)}\n\n")
        finally:
            producer.cancel()
            await asyncio.gather(producer, return_exceptions=True)
            await stream.aclose()

    async def _send(self, payload: str) -> None:
        try:
            self.write(payload)
            await self.flush()
        except tornado.iostream.StreamClosedError:
            self._disconnected.set()
            return
        # Force a yield so several tabs streaming at once make progress.
        await asyncio.sleep(0)


async def _drain(stream: AsyncIterator[ChatEvent], queue: asyncio.Queue) -> None:
    """Consume the provider stream into a queue, ending it with a None sentinel."""
    try:
        async for event in stream:
            await queue.put(event)
    except asyncio.CancelledError:
        raise
    except Exception as error:
        # Surfaced to the user instead of leaving the panel on a stream that never ends.
        await queue.put({"type": "error", "message": f"The answer stream failed: {error}"})
    finally:
        queue.put_nowait(None)


def _validate_messages(raw: object, config: SwanAI) -> list[dict[str, str]]:
    if not isinstance(raw, list) or not raw:
        raise ProviderError("The conversation is empty.")
    if len(raw) > config.max_history_messages:
        raise ProviderError(f"This conversation has more than {config.max_history_messages} messages. Start a new one.")

    messages = []
    total_chars = 0
    for entry in raw:
        if not isinstance(entry, dict):
            raise ProviderError("Malformed conversation.")
        role = entry.get("role")
        content = entry.get("content")
        if role not in VALID_ROLES or not isinstance(content, str) or not content.strip():
            raise ProviderError("Malformed conversation.")
        total_chars += len(content)
        messages.append({"role": role, "content": content})

    if total_chars > config.max_request_chars:
        raise ProviderError("This conversation is too long to send. Start a new one.")
    if messages[-1]["role"] != "user":
        raise ProviderError("The last message of the conversation must come from the user.")
    return messages


def _validate_model(raw: object, provider: str, default: str, config: SwanAI) -> str:
    model = str(raw).strip() if isinstance(raw, str) and raw.strip() else default
    allowlist = config.model_allowlist.get(provider)
    if allowlist and model not in allowlist:
        raise ProviderError(f"The model '{model}' is not allowed in this SWAN session.")
    return model


def setup_handlers(web_app, config: SwanAI):
    """Register API handlers with the Jupyter server."""
    base_url = web_app.settings["base_url"]
    web_app.settings["swan_ai_config"] = config

    handlers = [
        (url_path_join(base_url, "api", "swanai", "config"), ConfigHandler),
        (url_path_join(base_url, "api", "swanai", "models"), ModelsHandler),
        (url_path_join(base_url, "api", "swanai", "credentials"), CredentialsHandler),
        (url_path_join(base_url, "api", "swanai", "chat"), ChatHandler),
    ]
    web_app.add_handlers(".*", handlers)
