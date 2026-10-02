"""Provider registry.

Adding a vendor means writing one `ChatProvider` subclass and adding one entry to `PROVIDERS`.
"""

from __future__ import annotations

from swan_ai.config import SwanAI
from swan_ai.providers.anthropic_provider import AnthropicProvider
from swan_ai.providers.base import ChatEvent, ChatMessage, ChatProvider, ProviderError
from swan_ai.providers.openai_provider import OpenAIProvider

PROVIDERS: dict[str, type[ChatProvider]] = {
    AnthropicProvider.name: AnthropicProvider,
    OpenAIProvider.name: OpenAIProvider,
}

# Shown next to the provider in the settings UI.
DISPLAY_NAMES = {
    "anthropic": "Anthropic (Claude)",
    "openai": "OpenAI",
}


def known_providers() -> list[str]:
    return list(PROVIDERS)


def display_name(provider: str) -> str:
    return DISPLAY_NAMES.get(provider, provider)


def get_provider(provider: str, api_key: str, config: SwanAI) -> ChatProvider:
    """Build the provider named `provider`, or raise if it is unknown or disabled."""
    if provider not in config.enabled_providers:
        raise ProviderError(f"The provider '{provider}' is not enabled in this SWAN session.")
    try:
        provider_class = PROVIDERS[provider]
    except KeyError:
        raise ProviderError(f"Unknown provider '{provider}'.") from None
    return provider_class(api_key=api_key, config=config)


def default_model_for(provider: str) -> str:
    provider_class = PROVIDERS.get(provider)
    return provider_class.default_model if provider_class else ""


__all__ = [
    "PROVIDERS",
    "ChatEvent",
    "ChatMessage",
    "ChatProvider",
    "ProviderError",
    "default_model_for",
    "display_name",
    "get_provider",
    "known_providers",
]
