from ._version import __version__ 

def _jupyter_nbextension_paths():
    # Empty to avoid error when automatically trying to enable all nbextensions
    return []

def _jupyter_server_extension_paths():
    """Used by "jupyter serverextension" command to install web server extension'"""
    return [{
        "module": "swanoauthrenew.swanoauthrenew"
    }]
