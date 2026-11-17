import json
import stat

import pytest

from swan_ai.config import SwanAI
from swan_ai.credentials import CredentialStore, hint

PRIVATE_FILE_MODE = 0o600
PRIVATE_DIRECTORY_MODE = 0o700


@pytest.fixture
def store(tmp_path, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    config = SwanAI(credentials_path=str(tmp_path / "home" / ".swan" / "swanai" / "credentials.json"))
    return CredentialStore(config)


def test_missing_file_means_no_credentials(store):
    assert store.get("anthropic") is None
    assert store.status()["anthropic"]["configured"] is False


def test_save_and_read_back(store):
    store.save("anthropic", "sk-ant-api03-secret-value")

    credential = store.get("anthropic")
    assert credential is not None
    assert credential.api_key == "sk-ant-api03-secret-value"
    assert credential.source == "file"


def test_saved_file_is_private(store):
    store.save("anthropic", "sk-ant-api03-secret-value")

    mode = stat.S_IMODE(store.path.stat().st_mode)
    assert mode == PRIVATE_FILE_MODE, f"credentials file is {oct(mode)}, expected 0o600"

    directory_mode = stat.S_IMODE(store.path.parent.stat().st_mode)
    assert directory_mode == PRIVATE_DIRECTORY_MODE, f"credentials directory is {oct(directory_mode)}, expected 0o700"

    # No temporary leftovers holding the key next to it.
    assert [entry.name for entry in store.path.parent.iterdir()] == [store.path.name]


def test_saving_one_provider_keeps_the_other(store):
    store.save("anthropic", "sk-ant-api03-first-key")
    store.save("openai", "sk-proj-second-key-value")

    assert store.get("anthropic").api_key == "sk-ant-api03-first-key"
    assert store.get("openai").api_key == "sk-proj-second-key-value"


def test_delete_removes_only_that_provider(store):
    store.save("anthropic", "sk-ant-api03-first-key")
    store.save("openai", "sk-proj-second-key-value")

    store.delete("anthropic")

    assert store.get("anthropic") is None
    assert store.get("openai") is not None


def test_delete_is_idempotent(store):
    store.delete("anthropic")  # no file at all
    store.save("openai", "sk-proj-second-key-value")
    store.delete("anthropic")  # file without that provider

    assert store.get("openai") is not None


def test_environment_key_is_used_and_reported(store, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-proj-from-the-environment")

    credential = store.get("openai")
    assert credential.api_key == "sk-proj-from-the-environment"
    assert credential.source == "env"

    status = store.status()["openai"]
    assert status["configured"] is True
    assert status["source"] == "env"
    # A key the session provides is not the user's to overwrite or delete.
    assert status["editable"] is False


def test_saved_key_wins_over_the_environment(store, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-proj-from-the-environment")
    store.save("openai", "sk-proj-saved-by-the-user")

    assert store.get("openai").api_key == "sk-proj-saved-by-the-user"
    assert store.get("openai").source == "file"


def test_corrupted_file_does_not_raise(store):
    store.path.parent.mkdir(mode=0o700, parents=True)
    store.path.write_text("this is not json", encoding="utf-8")

    assert store.get("anthropic") is None

    # And it is repaired by the next save.
    store.save("anthropic", "sk-ant-api03-secret-value")
    assert json.loads(store.path.read_text(encoding="utf-8"))["anthropic"]["api_key"]


def test_status_never_exposes_the_key(store):
    key = "sk-ant-api03-secret-value"
    store.save("anthropic", key)

    serialised = json.dumps(store.status())
    assert key not in serialised
    assert "secret-value" not in serialised


def test_hint_keeps_the_key_unusable():
    key = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz"
    fragment = hint(key)

    assert key not in fragment
    assert len(fragment) < len(key)
    assert fragment.startswith("sk-ant-")
    assert fragment.endswith(key[-4:])


def test_hint_of_a_short_key_reveals_nothing():
    assert hint("short-key") == "•" * len("short-key")


def test_status_only_covers_enabled_providers(tmp_path):
    config = SwanAI(
        credentials_path=str(tmp_path / "credentials.json"),
        enabled_providers=["anthropic"],
    )
    assert list(CredentialStore(config).status()) == ["anthropic"]
