from ._version import __version__ 


def _jupyter_nbextension_paths():
    # Used by "jupyter nbextension" command to install frontend extension
    return [dict(
                section="notebook",
                src="nbextension",
                dest="savefailedpopup",
                require="savefailedpopup/extension"),
            ]

def _jupyter_server_extension_paths():
    # Empty to avoid error when automatically trying to enable all serverextensions
    return []