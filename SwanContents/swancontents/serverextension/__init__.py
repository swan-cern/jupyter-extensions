from jupyter_server.utils import url_path_join
from jupyter_server.base.handlers import path_regex
from jupyter_server import DEFAULT_TEMPLATE_PATH_LIST
from jupyter_server.serverapp import ServerApp

from .handlers.download import DownloadHandler, FetchHandler
import os


TEMPLATE_PATH = [os.path.join(os.path.dirname(__file__), "templates")]


# Automatically configure our templates
@property
def template_file_path(self):
    return self.extra_template_paths + TEMPLATE_PATH + DEFAULT_TEMPLATE_PATH_LIST


ServerApp.template_file_path = template_file_path


def _load_jupyter_server_extension(serverapp):
    """
    A server extension that installs extra handlers required for SWAN
    and that are not served by the default ContentsManager API.
    That are essentially all handlers required for downloads of Projects (open in SWAN).
    Enabling this extension also configures the SWAN theme automatically.
    """

    web_app = serverapp.web_app

    new_handlers = [
        (r"/api/contents/fetch", FetchHandler),
        (r"/download", DownloadHandler),
    ]

    for handler in new_handlers:
        pattern = url_path_join(web_app.settings["base_url"], handler[0])
        new_handler = tuple([pattern] + list(handler[1:]))
        web_app.add_handlers(".*$", [new_handler])
