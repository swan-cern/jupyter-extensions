# swan-marimo-proxy

A [Jupyter Server Proxy](https://jupyter-server-proxy.readthedocs.io/) extension
that integrates [Marimo](https://marimo.io/) into
[SWAN](https://swan.cern.ch/).

When installed, a **Marimo** launcher entry appears in the JupyterLab launcher.

## Installation

```bash
pip install swan-marimo-proxy
```

## Development

```bash
# Setup
git clone https://github.com/swan-cern/swan-marimo-proxy.git
cd swan-marimo-proxy
uv sync

# Run tests
pytest

# Start JupyterLab to test manually
jupyter lab
```
