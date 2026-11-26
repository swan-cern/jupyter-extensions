"""The providers are tested against fake SDK streams: what matters here is that both vendors
end up producing the same event vocabulary, since the panel only knows about that.
"""

from types import SimpleNamespace

import anthropic
import openai
import pytest

from swan_ai.config import SwanAI
from swan_ai.providers.anthropic_provider import AnthropicProvider
from swan_ai.providers.openai_provider import OpenAIProvider, _is_chat_model

MESSAGES = [{"role": "user", "content": "Hello"}]


async def collect(provider, **kwargs):
    kwargs.setdefault("model", provider.default_model)
    kwargs.setdefault("system", "system prompt")
    kwargs.setdefault("max_tokens", 1024)
    return [event async for event in provider.stream(MESSAGES, **kwargs)]


class FakeAsyncContext:
    """Stands in for an SDK object usable with `async with`."""

    def __init__(self, value):
        self._value = value

    async def __aenter__(self):
        return self._value

    async def __aexit__(self, *_):
        return False


# ─── Anthropic ───────────────────────────────────────────────────────────


class FakeAnthropicStream:
    def __init__(self, events, final):
        self._events = events
        self._final = final

    def __aiter__(self):
        async def iterator():
            for event in self._events:
                yield event

        return iterator()

    async def get_final_message(self):
        return self._final


def fake_anthropic_client(events, final):
    stream_calls = {}

    def stream(**kwargs):
        stream_calls.update(kwargs)
        return FakeAsyncContext(FakeAnthropicStream(events, final))

    client = SimpleNamespace(messages=SimpleNamespace(stream=stream))
    return FakeAsyncContext(client), stream_calls


@pytest.fixture
def config():
    return SwanAI()


async def test_anthropic_stream_is_normalised(config, monkeypatch):
    events = [
        SimpleNamespace(type="thinking", thinking="Let me think. "),
        SimpleNamespace(type="text", text="Hello "),
        SimpleNamespace(type="content_block_stop"),  # not surfaced
        SimpleNamespace(type="text", text="world"),
    ]
    final = SimpleNamespace(
        usage=SimpleNamespace(input_tokens=12, output_tokens=3),
        stop_reason="end_turn",
    )
    provider = AnthropicProvider(api_key="sk-ant-test", config=config)
    client, stream_calls = fake_anthropic_client(events, final)
    monkeypatch.setattr(provider, "_client", lambda: client)

    result = await collect(provider, model="claude-opus-5")

    assert result == [
        {"type": "start", "model": "claude-opus-5"},
        {"type": "thinking", "text": "Let me think. "},
        {"type": "delta", "text": "Hello "},
        {"type": "delta", "text": "world"},
        {"type": "usage", "input_tokens": 12, "output_tokens": 3},
        {"type": "done", "stop_reason": "end_turn"},
    ]

    # Parameters this model family rejects must not be sent.
    assert "budget_tokens" not in str(stream_calls)
    assert "temperature" not in stream_calls
    assert stream_calls["thinking"] == {"type": "adaptive", "display": "summarized"}
    assert stream_calls["output_config"] == {"effort": config.effort}


async def test_anthropic_refusal_becomes_an_error(config, monkeypatch):
    final = SimpleNamespace(
        usage=SimpleNamespace(input_tokens=5, output_tokens=0),
        stop_reason="refusal",
        stop_details=SimpleNamespace(explanation="Declined for safety reasons."),
    )
    provider = AnthropicProvider(api_key="sk-ant-test", config=config)
    client, _ = fake_anthropic_client([], final)
    monkeypatch.setattr(provider, "_client", lambda: client)

    result = await collect(provider)

    assert result[-1] == {"type": "error", "message": "Declined for safety reasons."}
    assert not any(event["type"] == "done" for event in result)


async def test_anthropic_bad_key_is_explained(config, monkeypatch):
    def broken():
        raise anthropic.AuthenticationError(
            "unauthorized",
            response=SimpleNamespace(status_code=401, headers={}, request=None),
            body=None,
        )

    provider = AnthropicProvider(api_key="sk-ant-wrong", config=config)
    monkeypatch.setattr(provider, "_client", broken)

    result = await collect(provider)

    assert result[0]["type"] == "start"
    assert result[-1]["type"] == "error"
    assert "API key" in result[-1]["message"]


async def test_anthropic_unexpected_failure_still_ends_the_stream(config, monkeypatch):
    def broken():
        raise RuntimeError("something odd")

    provider = AnthropicProvider(api_key="sk-ant-test", config=config)
    monkeypatch.setattr(provider, "_client", broken)

    result = await collect(provider)

    assert result[-1]["type"] == "error"
    assert "something odd" in result[-1]["message"]


# ─── OpenAI ──────────────────────────────────────────────────────────────


def chunk(text=None, finish_reason=None, usage=None):
    delta = SimpleNamespace(content=text)
    if text is None and finish_reason is None:
        return SimpleNamespace(choices=[], usage=usage)
    choices = [SimpleNamespace(delta=delta, finish_reason=finish_reason)]
    return SimpleNamespace(choices=choices, usage=usage)


def fake_openai_client(chunks):
    create_calls = {}

    async def create(**kwargs):
        create_calls.update(kwargs)

        async def iterator():
            for item in chunks:
                yield item

        return iterator()

    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    return FakeAsyncContext(client), create_calls


async def test_openai_stream_is_normalised(config, monkeypatch):
    chunks = [
        chunk("Hello "),
        chunk("world", finish_reason="stop"),
        chunk(usage=SimpleNamespace(prompt_tokens=9, completion_tokens=2)),
    ]
    provider = OpenAIProvider(api_key="sk-proj-test", config=config)
    client, create_calls = fake_openai_client(chunks)
    monkeypatch.setattr(provider, "_client", lambda: client)

    result = await collect(provider, model="gpt-5")

    assert result == [
        {"type": "start", "model": "gpt-5"},
        {"type": "delta", "text": "Hello "},
        {"type": "delta", "text": "world"},
        {"type": "usage", "input_tokens": 9, "output_tokens": 2},
        {"type": "done", "stop_reason": "stop"},
    ]

    # The system prompt is a message for this API shape, and it comes first.
    assert create_calls["messages"][0] == {"role": "system", "content": "system prompt"}
    assert create_calls["messages"][1:] == MESSAGES


async def test_openai_bad_key_is_explained(config, monkeypatch):
    def broken():
        raise openai.AuthenticationError(
            "unauthorized",
            response=SimpleNamespace(status_code=401, headers={}, request=None),
            body=None,
        )

    provider = OpenAIProvider(api_key="sk-proj-wrong", config=config)
    monkeypatch.setattr(provider, "_client", broken)

    result = await collect(provider)

    assert result[-1]["type"] == "error"
    assert "API key" in result[-1]["message"]


@pytest.mark.parametrize(
    ("model_id", "expected"),
    [
        ("gpt-5", True),
        ("gpt-4o-mini", True),
        ("o3-mini", True),
        ("text-embedding-3-large", False),
        ("whisper-1", False),
        ("dall-e-3", False),
        ("gpt-4o-realtime-preview", False),
    ],
)
def test_chat_model_filter(model_id, expected):
    assert _is_chat_model(model_id) is expected


# ─── Model allowlist ─────────────────────────────────────────────────────


def test_allowlist_restricts_the_advertised_models():
    config = SwanAI(model_allowlist={"anthropic": ["claude-opus-5", "claude-haiku-4-5"]})
    provider = AnthropicProvider(api_key="sk-ant-test", config=config)

    assert provider.allowed_models(["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"]) == [
        "claude-opus-5",
        "claude-haiku-4-5",
    ]


def test_allowlist_applies_even_when_the_vendor_cannot_be_reached():
    config = SwanAI(model_allowlist={"anthropic": ["claude-haiku-4-5"]})
    provider = AnthropicProvider(api_key="sk-ant-test", config=config)

    assert provider.allowed_models([]) == ["claude-haiku-4-5"]


def test_no_allowlist_keeps_everything():
    provider = AnthropicProvider(api_key="sk-ant-test", config=SwanAI())

    assert provider.allowed_models(["a", "b"]) == ["a", "b"]
