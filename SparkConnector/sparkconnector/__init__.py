from .connector import *


def _jupyter_server_extension_paths():
    """ Used by "jupyter serverextension" command to install web server extension """
    return [{
        "module": "sparkconnector.connector"
    }]

def _jupyter_nbextension_paths():
    """ Used by "jupyter nbextension" command to install frontend extension """
    return [dict(
                section="notebook",
                src="js",
                dest="sparkconnector",
                require="sparkconnector/extension"),
            ]
