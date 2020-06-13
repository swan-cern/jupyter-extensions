from ._version import __version__ 


def _jupyter_nbextension_paths():
    # Used by "jupyter nbextension" command to install frontend extension
    return [dict(
                section="common",
                src="nbextension",
                dest="swanhelp",
                require="swanhelp/extension"),
            ]

def _jupyter_server_extension_paths():
    # Empty to avoid error when automatically trying to enable all serverextensions
    return []