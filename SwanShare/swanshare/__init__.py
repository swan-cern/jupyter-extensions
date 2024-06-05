from ._version import __version__ 


def _jupyter_nbextension_paths():
    # Used by "jupyter nbextension" command to install frontend extension
    return [dict(
                section="tree",
                src="nbextension",
                dest="swanshare",
                require="swanshare/extension"),
            dict(
                section="notebook",
                src="nbextension",
                dest="swanshare",
                require="swanshare/extension"),
            ]

def _jupyter_server_extension_points():
    # Empty to avoid error when automatically trying to enable all serverextensions
    return [{"module": "swanshare.serverextension"}]