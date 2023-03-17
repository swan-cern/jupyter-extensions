
import json
import os.path as osp

from ._version import __version__

# Lab extension
HERE = osp.abspath(osp.dirname(__file__))

with open(osp.join(HERE, 'labextension', 'package.json')) as fid:
    data = json.load(fid)

def _jupyter_labextension_paths():
    return [{
        'src': 'labextension',
        'dest': data['name']
    }]


# Server extension
def _jupyter_server_extension_points():
    # Empty to avoid error when automatically trying to enable all serverextensions
    return []

# Compatibility with old nb server extensions
def _jupyter_server_extension_paths():
    return []

# NB extension
def _jupyter_nbextension_paths():
    return [dict(
                section="common",
                src="nbextension",
                dest="swanhelp",
                require="swanhelp/extension"),
            ]