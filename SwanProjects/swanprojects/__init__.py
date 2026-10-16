
from .handlers import setup_handlers
from ._version import __version__


def _jupyter_labextension_paths():
    return [{
        "src": "labextensions/@swan/filebrowser-extension",
        "dest": "@swan/filebrowser-extension"
    },
    {
        "src": "labextensions/@swan/launcher-extension",
        "dest": "@swan/launcher-extension"
    },
    {
        "src": "labextensions/@swan/projects-extension",
        "dest": "@swan/projects-extension"
    },
    {
        "src": "labextensions/@swan/terminal-extension",
        "dest": "@swan/terminal-extension"
    }]


def _jupyter_server_extension_points():
    return [{
        "module": "swanprojects"
    }]


def _load_jupyter_server_extension(server_app):
    """Registers the API handler to receive HTTP requests from the frontend extension.

    Parameters
    ----------
    server_app: jupyterlab.labapp.LabApp
        JupyterLab application instance
    """
    print(f"JupyterLab swanprojects {__version__} is activated!")
    url_path = "swan"
    setup_handlers(server_app.web_app, url_path)
    server_app.log.info(
        f"Registered swanprojects extension at URL path /{url_path}"
    )


# For backward compatibility with notebook server - useful for Binder/JupyterHub
load_jupyter_server_extension = _load_jupyter_server_extension
