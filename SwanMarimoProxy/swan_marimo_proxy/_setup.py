"""Configuration for the Marimo server proxy in SWAN.

The following environment variables control behavior:

    HOME
        Directory where Marimo's file browser starts.
        Falls back to ~ if not set.

    JUPYTERHUB_SERVICE_PREFIX
        Set automatically by JupyterHub. Used to build the
        --base-url flag. Falls back to "/" for standalone JupyterLab.
"""

import base64
import os
import secrets
from pathlib import Path


def resolve_home_directory() -> str:
    return os.environ.get("HOME") or str(Path.home())


def build_base_url() -> str:
    prefix = os.environ.get("JUPYTERHUB_SERVICE_PREFIX", "").rstrip("/")
    return f"{prefix}/marimo"


def setup_marimo() -> dict:
    """Return the ``jupyter-server-proxy`` configuration for Marimo."""
    token = secrets.token_urlsafe(32)
    home = resolve_home_directory()
    base_url = build_base_url()

    command = [
        "marimo",
        "edit",
        home,
        "--port",
        "{port}",
        "--base-url",
        base_url,
        "--token",
        "--token-password",
        token,
        "--headless",
    ]

    credentials = 'Basic ' + base64.b64encode(b' :' + token.encode()).decode()

    return {
        "command": command,
        "environment": {},
        "timeout": 120,
        "absolute_url": True,
        "request_headers_override": {
            "Authorization": credentials,
        },
        "launcher_entry": {
            "title": "Marimo",
            "icon_path": str(Path(__file__).resolve().parent / "icons" / "marimo.svg"),
        },
    }
