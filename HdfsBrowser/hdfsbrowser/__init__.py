"""
    Package hdfsbrowser
    This package contains two modules:
    serverextension.py is the Jupyter web server extension.
"""


def _jupyter_nbextension_paths():
    """Used by 'jupyter nbextension' command to install frontend extension"""
    return [dict(
        section="notebook",
        # the path is relative to the `my_fancy_module` directory
        src="static",
        # directory in the `nbextension/` namespace
        dest="hdfsbrowser",
        # _also_ in the `nbextension/` namespace
        require="hdfsbrowser/extension")]


def _jupyter_server_extension_paths():
    """Used by "jupyter serverextension" command to install web server extension'"""
    return [{
        "module": "hdfsbrowser.serverextension"
    }]
