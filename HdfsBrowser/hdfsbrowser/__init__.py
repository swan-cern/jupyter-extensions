from hdfsbrowser.serverextension import HDFSBrowserProxy
from jupyter_server.utils import url_path_join
try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings
    warnings.warn("Importing 'hdfsbrowser' outside a proper installation.")
    __version__ = "dev"


def _jupyter_nbextension_paths():
    """Used by 'jupyter nbextension' command to install frontend extension
    """
    return [dict(
        section="notebook",
        src="nbextension",
        dest="hdfsbrowser",
        require="hdfsbrowser/extension"
    )]

def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": "@swan-cern/hdfsbrowser"
    }]

def _jupyter_server_extension_points():
    return [{
        "module": "hdfsbrowser"
    }]


def _load_jupyter_server_extension(server_app):
    """Registers the API handler to receive HTTP requests from the frontend extension.

    Parameters
    ----------
    server_app: jupyterlab.labapp.LabApp
        JupyterLab application instance
    """

    base_url = server_app.web_app.settings["base_url"]
    hdfs_browser_proxy_root = '/hdfsbrowser'
    hdfs_browser_endpoint = url_path_join(base_url, hdfs_browser_proxy_root)
    hadoop_handlers = [
        (hdfs_browser_endpoint + ".*", HDFSBrowserProxy,
         dict(proxy_root=hdfs_browser_proxy_root))
    ]
    server_app.web_app.add_handlers(".*", hadoop_handlers)
    server_app.log.info(f"Registered hdfsbrowser server extension")