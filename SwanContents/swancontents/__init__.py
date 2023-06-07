from ._version import __version__


def _jupyter_server_extension_paths():
    from .swanclassic.notebookapp import NotebookApp

    return [
        {
            "module": "swancontents.swanclassic.notebookapp",
            "app": NotebookApp,
            "name": "jupyter-swanclassic",
        },
        {"module": "swancontents.serverextension"},
    ]
