"""Jupyter Server Proxy extension to launch Marimo within SWAN."""

from swan_marimo_proxy._setup import setup_marimo
from swan_marimo_proxy._version import __version__

__all__ = ["__version__", "setup_marimo"]
