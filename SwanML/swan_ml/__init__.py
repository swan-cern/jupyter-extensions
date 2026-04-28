from swan_ml._version import __version__

__all__ = ["__version__"]


def _jupyter_labextension_paths():
    """Register the JupyterLab frontend extension."""
    return [
        {
            "src": "labextension",
            "dest": "swan-ml",
        }
    ]


def _jupyter_server_extension_points():
    """Register as a Jupyter server extension."""
    return [{"module": "swan_ml"}]


def _load_jupyter_server_extension(server_app):
    """Called by Jupyter server to initialize the extension."""
    from swan_ml.config import SwanML
    from swan_ml.handlers import setup_handlers

    config = SwanML(config=server_app.config)
    setup_handlers(server_app.web_app, config)
    server_app.log.info("swan-ml server extension loaded")
