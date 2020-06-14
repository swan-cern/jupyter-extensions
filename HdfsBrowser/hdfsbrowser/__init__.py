from hdfsbrowser.serverextension import HDFSBrowserProxy
from notebook.utils import url_path_join
from ._version import __version__ 

"""
    Package hdfsbrowser
    This package contains a server, nb and lab extensions
"""


def _jupyter_nbextension_paths():
    """Used by 'jupyter nbextension' command to install frontend extension
    """
    return [dict(
        section="notebook",
        src="nbextension",
        dest="hdfsbrowser",
        require="hdfsbrowser/extension")]


def _jupyter_server_extension_paths():
    """Declare the Jupyter server extension paths.
    """
    return [{"module": "hdfsbrowser"}]


def load_jupyter_server_extension(nbapp):
    """Load the Jupyter server extension.
    """

    base_url = nbapp.web_app.settings["base_url"]
    hdfs_browser_proxy_root = '/hdfsbrowser'
    hdfs_browser_endpoint = url_path_join(base_url, hdfs_browser_proxy_root)
    hadoop_handlers = [
        (hdfs_browser_endpoint+ ".*", HDFSBrowserProxy, dict(proxy_root=hdfs_browser_proxy_root))
    ]
    nbapp.web_app.add_handlers(".*", hadoop_handlers)