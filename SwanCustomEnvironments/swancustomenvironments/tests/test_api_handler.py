from unittest.mock import MagicMock

import pytest

from ..serverextension import SwanCustomEnvironmentsApiHandler


# ── Helpers ──────────────────────────────────────────────────────────────────

class FakeHandler:
    """Minimal stand-in for SwanCustomEnvironmentsApiHandler used in streaming tests."""

    def __init__(self, log_file: str):
        self.LOG_FILE = log_file
        self.sent: list[str] = []

    async def _send_line(self, line: str) -> None:
        self.sent.append(line)


class FakeProcess:
    """Mock subprocess whose poll() returns values from a predefined sequence."""

    def __init__(self, poll_values: list):
        self._it = iter(poll_values)

    def poll(self):
        return next(self._it, 0)


def make_monotonic(values: list[float]):
    it = iter(values)
    return lambda: next(it)


async def noop_sleep(_: float) -> None:
    pass


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def empty_log(tmp_path):
    log = tmp_path / "makenv.log"
    log.write_text("")
    return log


@pytest.fixture
def patch_sleep(monkeypatch):
    monkeypatch.setattr("swancustomenvironments.serverextension.sleep", noop_sleep)


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestSwanCustomEnvironmentsApiHandler:
    class TestBuildMakenvArgs:
        @pytest.mark.parametrize("builder_version,nxcals,expected_tail", [
            ("",     "",  []),
            ("v3.9", "",  ["--builder_version", "v3.9"]),
            ("",     "1", ["--nxcals"]),
            ("v3.9", "1", ["--builder_version", "v3.9", "--nxcals"]),
        ])
        def test_optional_args(self, builder_version, nxcals, expected_tail):
            args = SwanCustomEnvironmentsApiHandler._build_makenv_args(
                "https://github.com/user/repo", "mamba", builder_version, nxcals
            )
            assert args[:4] == ["--repository", "https://github.com/user/repo", "--builder", "mamba"]
            assert args[4:] == expected_tail

        def test_empty_nxcals_excluded(self):
            args = SwanCustomEnvironmentsApiHandler._build_makenv_args(
                "https://github.com/user/repo", "venv", "", ""
            )
            assert "--nxcals" not in args

    class TestLaunchMakenv:
        def test_spawns_process_with_correct_args_and_log_file(self, tmp_path, monkeypatch):
            log_path = str(tmp_path / "makenv.log")

            query_args = {
                "repository": "https://github.com/user/repo",
                "builder": "mamba",
                "builder_version": "v3.9",
                "nxcals": "",
            }

            class FakeLaunchHandler:
                LOG_FILE = log_path
                makenv_path = SwanCustomEnvironmentsApiHandler.makenv_path
                _build_makenv_args = staticmethod(SwanCustomEnvironmentsApiHandler._build_makenv_args)
                def get_query_argument(self, name, default=""):
                    return query_args.get(name, default)

            fake_file = MagicMock()
            fake_file.__enter__.return_value = fake_file

            open_calls = []
            def mock_open(path, mode):
                open_calls.append((path, mode))
                return fake_file

            popen_calls = []
            mock_process = MagicMock()
            def mock_popen(cmd, stdout=None, stderr=None):
                popen_calls.append({"cmd": cmd, "stdout": stdout, "stderr": stderr})
                return mock_process

            monkeypatch.setattr("builtins.open", mock_open)
            monkeypatch.setattr("swancustomenvironments.serverextension.Popen", mock_popen)

            result = SwanCustomEnvironmentsApiHandler._launch_makenv(FakeLaunchHandler())

            assert open_calls == [(log_path, "w")]
            assert len(popen_calls) == 1
            cmd = popen_calls[0]["cmd"]
            assert cmd[0] == SwanCustomEnvironmentsApiHandler.makenv_path
            assert cmd[1:] == ["--repository", "https://github.com/user/repo",
                                "--builder", "mamba",
                                "--builder_version", "v3.9"]
            assert popen_calls[0]["stdout"] is fake_file
            assert popen_calls[0]["stderr"] is fake_file
            assert result is mock_process

    class TestProcessLogStream:
        async def test_forwards_output_lines(self, tmp_path, monkeypatch, patch_sleep):
            log = tmp_path / "makenv.log"
            log.write_text("line1\nline2\n")
            handler = FakeHandler(str(log))
            monkeypatch.setattr("swancustomenvironments.serverextension.monotonic", lambda: 0.0)

            await SwanCustomEnvironmentsApiHandler._process_log_stream(handler, FakeProcess([0]))

            assert handler.sent == ["line1\n", "line2\n"]

        async def test_exits_immediately_when_done_and_empty(self, empty_log, monkeypatch, patch_sleep):
            handler = FakeHandler(str(empty_log))
            monkeypatch.setattr("swancustomenvironments.serverextension.monotonic", lambda: 0.0)

            await SwanCustomEnvironmentsApiHandler._process_log_stream(handler, FakeProcess([0]))

            assert handler.sent == []

        async def test_sends_keepalive_when_idle(self, empty_log, monkeypatch, patch_sleep):
            handler = FakeHandler(str(empty_log))
            # init=0.0, check after sleep=5.1 (>5s threshold), update after keepalive=5.1
            monkeypatch.setattr(
                "swancustomenvironments.serverextension.monotonic",
                make_monotonic([0.0, 5.1, 5.1]),
            )

            await SwanCustomEnvironmentsApiHandler._process_log_stream(
                handler, FakeProcess([None, 0])
            )

            assert handler.sent == ["# keepalive\n"]

        async def test_no_keepalive_before_interval(self, empty_log, monkeypatch, patch_sleep):
            handler = FakeHandler(str(empty_log))
            # 4.9s elapsed — below the 5s KEEPALIVE_INTERVAL
            monkeypatch.setattr(
                "swancustomenvironments.serverextension.monotonic",
                make_monotonic([0.0, 4.9]),
            )

            await SwanCustomEnvironmentsApiHandler._process_log_stream(
                handler, FakeProcess([None, 0])
            )

            assert "# keepalive\n" not in handler.sent

        async def test_resets_keepalive_timer_on_real_output(self, tmp_path, monkeypatch, patch_sleep):
            log = tmp_path / "makenv.log"
            log.write_text("output\n")
            handler = FakeHandler(str(log))
            # Timer resets to t=1.0 when output arrives; at t=5.5 only 4.5s have passed
            monkeypatch.setattr(
                "swancustomenvironments.serverextension.monotonic",
                make_monotonic([0.0, 1.0, 5.5]),
            )

            await SwanCustomEnvironmentsApiHandler._process_log_stream(
                handler, FakeProcess([None, 0])
            )

            assert "output\n" in handler.sent
            assert "# keepalive\n" not in handler.sent
