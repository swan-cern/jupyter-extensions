from pathlib import Path

import pytest

from swan_marimo_proxy._setup import (
    build_base_url,
    resolve_home_directory,
    setup_marimo,
)


@pytest.mark.parametrize(
    ("home", "expected"),
    [
        ("/custom/home", "/custom/home"),
        ("", "/"),
    ],
)
def test_resolve_home_directory(monkeypatch, home: str, expected: str):
    monkeypatch.setenv("HOME", home)
    assert resolve_home_directory() == expected


@pytest.mark.parametrize(
    ("hub_prefix", "expected_base_url"),
    [
        ("/user/johndoe/", "/user/johndoe/marimo"),
        ("/user/johndoe", "/user/johndoe/marimo"),
        ("", "/marimo"),
    ],
)
def test_build_base_url(monkeypatch, hub_prefix: str, expected_base_url: str):
    monkeypatch.setenv("JUPYTERHUB_SERVICE_PREFIX", hub_prefix)
    assert build_base_url() == expected_base_url


def test_setup_marimo():
    config = setup_marimo()
    assert isinstance(config, dict)
    assert config["command"][0] == "marimo"
    assert config["command"][1] == "edit"
    assert "{port}" in config["command"]
    assert config["absolute_url"] is True
    assert config["timeout"] == 120
    assert "Authorization" in config["request_headers_override"]
    assert config["launcher_entry"]["title"] == "Marimo"
    assert Path(config["launcher_entry"]["icon_path"]).exists()
