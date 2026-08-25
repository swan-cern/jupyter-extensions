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
