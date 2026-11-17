"""Per-user storage of AI provider API keys.

The keys live in a single JSON file inside the user's home directory, written with mode 0600
inside a 0700 directory. They are read only by this server extension, which is already a
per-user process, and are used only to build the provider clients.

An API key must never leave this module towards the browser or the logs. Anything shown in the
UI goes through `hint()`, which keeps a handful of characters so a user can tell two keys apart.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

from swan_ai.config import SwanAI

# Below this length a key has too little material to show a recognisable fragment of it.
MIN_HINTABLE_LENGTH = 12

# Environment variables consulted when a provider has no key in the credentials file.
# This is how a centrally provisioned key (injected by the spawner) reaches the extension.
ENV_VARS = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
}


@dataclass(frozen=True)
class Credential:
    """An API key and where it came from."""

    provider: str
    api_key: str
    source: str  # "file" for a key the user saved, "env" for one provided by the environment

    @property
    def hint(self) -> str:
        return hint(self.api_key)


def hint(api_key: str) -> str:
    """Return a fragment of a key, enough to recognise it and not enough to use it."""
    if len(api_key) <= MIN_HINTABLE_LENGTH:
        # Too short to show anything safely: only reveal the length.
        return "•" * len(api_key)
    return f"{api_key[:7]}…{api_key[-4:]}"


class CredentialStore:
    """Reads and writes the credentials file of the user running this server."""

    def __init__(self, config: SwanAI):
        self._config = config
        self._path = Path(os.path.expanduser(config.credentials_path))

    @property
    def path(self) -> Path:
        return self._path

    def _read_file(self) -> dict[str, str]:
        try:
            raw = self._path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return {}
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            # A corrupted file must not take the whole panel down; it is replaced on the next save.
            return {}
        if not isinstance(data, dict):
            return {}
        return {
            provider: value["api_key"]
            for provider, value in data.items()
            if isinstance(value, dict) and isinstance(value.get("api_key"), str) and value["api_key"]
        }

    def _write_file(self, keys: dict[str, str]) -> None:
        """Write the credentials file atomically, never leaving it readable by others."""
        directory = self._path.parent
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)

        payload = json.dumps(
            {provider: {"api_key": key} for provider, key in sorted(keys.items())},
            indent=2,
        )

        # Create the temporary file with the final permissions rather than relying on the umask,
        # so the key is never on disk in a world-readable file, not even briefly.
        tmp_path = directory / f".{self._path.name}.tmp"
        fd = os.open(tmp_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
        except BaseException:
            tmp_path.unlink(missing_ok=True)
            raise

        os.replace(tmp_path, self._path)
        # EOS and other network filesystems do not always preserve the mode across the rename.
        os.chmod(self._path, 0o600)

    def get(self, provider: str) -> Credential | None:
        """Return the key configured for a provider, or None when there is none."""
        key = self._read_file().get(provider)
        if key:
            return Credential(provider=provider, api_key=key, source="file")

        env_var = ENV_VARS.get(provider)
        env_key = os.environ.get(env_var, "").strip() if env_var else ""
        if env_key:
            return Credential(provider=provider, api_key=env_key, source="env")

        return None

    def status(self) -> dict[str, dict]:
        """Describe the configured providers without disclosing any key."""
        result = {}
        for provider in self._config.enabled_providers:
            credential = self.get(provider)
            result[provider] = {
                "configured": credential is not None,
                "source": credential.source if credential else None,
                "hint": credential.hint if credential else None,
                # A key coming from the environment is not ours to overwrite or delete.
                "editable": self._config.allow_user_credentials and (credential is None or credential.source == "file"),
            }
        return result

    def save(self, provider: str, api_key: str) -> None:
        keys = self._read_file()
        keys[provider] = api_key
        self._write_file(keys)

    def delete(self, provider: str) -> None:
        keys = self._read_file()
        if keys.pop(provider, None) is None:
            return
        self._write_file(keys)
