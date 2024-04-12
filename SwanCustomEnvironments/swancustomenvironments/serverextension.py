from tornado import web
from traitlets.config import Configurable

from jupyter_server.base.handlers import JupyterHandler, APIHandler
from jupyter_server.utils import url_path_join
import json



class SwanCustomEnvironments(Configurable):
    # TODO set configs here, check e.g. SwanShare
    pass


class SwanCustomEnvironmentsApiHandler(APIHandler):

    config = None

    def initialize(self):
        self.config = SwanCustomEnvironments(config=self.config)

    @web.authenticated
    def get(self):
        self.set_header("Content-Type", "application/json")
        self.finish(json.dumps({
            'hello': 'world'
        }))


class SwanCustomEnvironmentsHandler(JupyterHandler):
    """Render the downloads view"""

    @web.authenticated
    def get(self):
        self.write(
            self.render_template(
                "customenvs.html",
                page_title="Creating custom environment",
            )
        )

def _load_jupyter_server_extension(serverapp):
    """
    A server extension that installs extra handlers required for SWAN
    and that are not served by the default ContentsManager API.
    That are essentially all handlers required for downloads of Projects (open in SWAN).
    Enabling this extension also configures the SWAN theme automatically.
    """

    web_app = serverapp.web_app

    new_handlers = [
        (r"/api/customenvs", SwanCustomEnvironmentsApiHandler),
        (r"/customenvs", SwanCustomEnvironmentsHandler),
    ]

    for handler in new_handlers:
        pattern = url_path_join(web_app.settings["base_url"], handler[0])
        new_handler = tuple([pattern] + list(handler[1:]))
        web_app.add_handlers(".*$", [new_handler])
