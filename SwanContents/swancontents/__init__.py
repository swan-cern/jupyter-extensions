from ._version import __version__ 
from .filemanager import *
from .handlers import *
import os


def get_templates():
    path = os.path.abspath(__file__)
    return os.path.join(os.path.dirname(path), 'templates')


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
            dict(
                section="common",
                src="js",
                dest="swancontents",
                require="swancontents/utils"),
            ]


def _jupyter_server_extension_paths():
    return [{
        "module": "swancontents"
    }]

