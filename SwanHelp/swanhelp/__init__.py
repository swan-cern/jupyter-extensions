try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings
    warnings.warn("Importing 'swanhelp' outside a proper installation.")
    __version__ = "dev"


def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": "@swan-cern/swanhelp"
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