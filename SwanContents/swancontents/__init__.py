from ._version import __version__


def _jupyter_server_extension_points():
    from .swanclassic.notebookapp import NotebookApp

    return [
        {
            "module": "swancontents.swanclassic.notebookapp",
            "app": NotebookApp,
            "name": "jupyter-swanclassic",
        },
        {"module": "swancontents.serverextension"},
    ]

def _jupyter_labextension_paths():
    return [{
        "src": "swanclassic/labextension",
        "dest": "@swanclassic/lab-extension"
    }]