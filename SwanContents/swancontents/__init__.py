from .filemanager import *
from .handlers import *


def _jupyter_nbextension_paths():
    # Used by "jupyter nbextension" command to install frontend extension
    return [dict(
                section="tree",
                src="js",
                dest="swancontents",
                require="swancontents/contents"),
            dict(
                section="tree",
                src="js",
                dest="swancontents",
                require="swancontents/notebooklist"),
            ]



def _jupyter_server_extension_paths():
    return [{
        "module": "swancontents"
    }]

