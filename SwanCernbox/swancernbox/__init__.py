"""JupyterLab extension for navigating CERNBox integration."""

__version__ = "0.1.0"


def _jupyter_labextension_paths():
    return [
        {
            "src": "labextension",
            "dest": "@swan-cern/swancernbox",
        }
    ]
