from ._version import __version__

def _jupyter_server_extension_points():
    """Used by "jupyter serverextension" command to install web server extension'"""
    return [{
        "module": "swanportallocator.portallocator"
    }]
