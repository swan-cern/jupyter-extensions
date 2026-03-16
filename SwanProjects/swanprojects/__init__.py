from .handlers import setup_handlers
from ._version import __version__
import jupyter_server.serverapp
from .swanprovisioner import SwanProvisioner

def _jupyter_labextension_paths():
    return [
        {
            "src": "labextension/@swan/projects-extension",
            "dest": "@swan/projects-extension",
        },
    ]


def _jupyter_server_extension_points():
    return [{"module": "swanprojects"}]


def _load_jupyter_server_extension(server_app: jupyter_server.serverapp.ServerApp):
    """Registers custom API handlers to receive HTTP requests from the frontend extensions."""
    print(f"JupyterLab swanprojects {__version__} is activated!")
    setup_handlers(server_app.web_app, server_app.notebook_dir)



# For backward compatibility with notebook server - useful for Binder/JupyterHub
load_jupyter_server_extension = _load_jupyter_server_extension
