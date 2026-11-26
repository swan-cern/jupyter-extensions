"""The provider interface.

Every provider turns its own SDK's stream into the same small vocabulary of events, so the
handler and the frontend never need to know which vendor answered:

    {"type": "start",    "model": str}
    {"type": "thinking", "text": str}      # reasoning summary, when the model exposes one
    {"type": "delta",    "text": str}      # a fragment of the answer
    {"type": "usage",    "input_tokens": int, "output_tokens": int}
    {"type": "done",     "stop_reason": str | None}
    {"type": "error",    "message": str}   # already phrased for the user

A provider yields at most one terminal event ("done" or "error") and stops after it.

Adding a capability later (tool calls, citations) means adding an event type here and handling
it in the panel; it does not mean changing this interface.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

from swan_ai.config import SwanAI

# A conversation turn as it arrives from the browser: {"role": "user"|"assistant", "content": str}
ChatMessage = dict[str, str]
ChatEvent = dict[str, object]


class ProviderError(Exception):
    """An error with a message that can be shown to the user as it is."""


class ChatProvider(ABC):
    """A vendor whose API can answer a chat conversation."""

    name: str
    #: Model offered when neither the user nor the configuration picked one.
    default_model: str
    #: Models to offer without querying the vendor, so the picker is never empty.
    fallback_models: list[str]

    def __init__(self, api_key: str, config: SwanAI):
        self._api_key = api_key
        self._config = config

    @abstractmethod
    async def list_models(self) -> list[str]:
        """Return the model ids this provider currently offers, best effort."""

    @abstractmethod
    def stream(
        self,
        messages: list[ChatMessage],
        *,
        model: str,
        system: str,
        max_tokens: int,
    ) -> AsyncIterator[ChatEvent]:
        """Stream the answer to `messages` as the events described above."""

    def allowed_models(self, advertised: list[str]) -> list[str]:
        """Restrict a list of models to the ones the administrator allows."""
        allowlist = self._config.model_allowlist.get(self.name)
        if not allowlist:
            return advertised
        if not advertised:
            return list(allowlist)
        return [model for model in advertised if model in allowlist]
