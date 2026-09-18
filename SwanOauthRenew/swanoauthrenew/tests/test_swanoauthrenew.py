import logging
from types import SimpleNamespace

import pytest

from ..swanoauthrenew import TokenRefresher


# ── Helpers ──────────────────────────────────────────────────────────────────

class FakeResponse:
    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body

    def json(self):
        return self._body


def make_refresher(files=None):
    """Construct a TokenRefresher with controlled state, bypassing __init__ env var reads."""
    refresher = object.__new__(TokenRefresher)
    refresher.log = logging.getLogger("test")
    refresher.config = SimpleNamespace(files=files or [])
    refresher.api_url = "http://fake-hub/hub/api"
    refresher.api_token = "fake-token"
    return refresher


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestTokenRefresher:
    class TestExtractToken:
        def test_extracts_top_level_key(self):
            assert TokenRefresher._extract_token({"access_token": "tok123"}, "access_token") == "tok123"

        def test_extracts_nested_key(self):
            auth_state = {"exchanged_tokens": {"eos-service": "eos-tok"}}
            assert TokenRefresher._extract_token(auth_state, "exchanged_tokens/eos-service") == "eos-tok"

        def test_raises_key_error_on_missing_key(self):
            with pytest.raises(KeyError):
                TokenRefresher._extract_token({}, "missing")

    class TestRefreshToken:
        def test_raises_on_non_ok_response(self, monkeypatch):
            monkeypatch.setattr("requests.get", lambda *a, **kw: FakeResponse(500, {}))
            with pytest.raises(Exception, match="Non ok code"):
                make_refresher().refresh_token()

        def test_writes_token_to_file_with_format(self, tmp_path, monkeypatch):
            token_file = tmp_path / "eos.token"
            monkeypatch.setattr("requests.get", lambda *a, **kw: FakeResponse(200, {
                "auth_state": {"access_token": "my-token"},
            }))
            monkeypatch.setattr("jwt.decode", lambda *a, **kw: {"exp": 1000})
            monkeypatch.setattr("time.time", lambda: 800.0)

            make_refresher(files=[
                (str(token_file), "access_token", "oauth2:{token}:auth.cern.ch"),
            ]).refresh_token()

            assert token_file.read_text() == "oauth2:my-token:auth.cern.ch"

        def test_returns_minimum_ttl_across_files(self, tmp_path, monkeypatch):
            file1, file2 = tmp_path / "tok1.token", tmp_path / "tok2.token"
            # Token 1 exp=1000 → TTL=140, Token 2 exp=950 → TTL=90; minimum wins
            exp_values = iter([1000, 950])
            monkeypatch.setattr("requests.get", lambda *a, **kw: FakeResponse(200, {
                "auth_state": {"tok1": "t1", "tok2": "t2"},
            }))
            monkeypatch.setattr("jwt.decode", lambda *a, **kw: {"exp": next(exp_values)})
            monkeypatch.setattr("time.time", lambda: 800.0)

            result = make_refresher(files=[
                (str(file1), "tok1", "{token}"),
                (str(file2), "tok2", "{token}"),
            ]).refresh_token()

            assert result == 90

        def test_clamps_ttl_to_60_when_expired(self, tmp_path, monkeypatch):
            token_file = tmp_path / "tok.token"
            # exp=820, time=800 → TTL = 820-800-60 = -40 → clamped to 60
            monkeypatch.setattr("requests.get", lambda *a, **kw: FakeResponse(200, {
                "auth_state": {"access_token": "tok"},
            }))
            monkeypatch.setattr("jwt.decode", lambda *a, **kw: {"exp": 820})
            monkeypatch.setattr("time.time", lambda: 800.0)

            result = make_refresher(files=[
                (str(token_file), "access_token", "{token}"),
            ]).refresh_token()

            assert result == 60
