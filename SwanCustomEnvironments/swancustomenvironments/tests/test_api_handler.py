from unittest.mock import MagicMock

import pytest

from ..serverextension import SwanCustomEnvironmentsApiHandler


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
