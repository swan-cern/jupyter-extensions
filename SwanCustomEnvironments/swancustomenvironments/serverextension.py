from tornado import web
from traitlets.config import Configurable

from jupyter_server.base.handlers import JupyterHandler, APIHandler
from jupyter_server.utils import url_path_join

import subprocess
from os import environ, path


class SwanCustomEnvironments(Configurable):
    # TODO set configs here, check e.g. SwanShare
    pass


class SwanCustomEnvironmentsApiHandler(APIHandler):

    config = None

    def initialize(self):
        self.config = SwanCustomEnvironments(config=self.config)

    @web.authenticated
    def get(self):
        self.set_header("Content-Type", "text/event-stream")
        
        env_name = self.get_query_argument("env", default=None)
        req = self.get_query_argument("req", default=None)
        clear = self.get_query_argument("clear", default="true")
        accpy_version = self.get_query_argument("accpy", default=None)
        custom_python = self.get_query_argument("python", default=None)

        if not req.startswith("http"):
            req = path.join(environ["HOME"], req)

        try:
            arguments = ["--env", env_name, "--req", req]
            if clear.lower() == "true":
                arguments.extend(["--clear"])
            if accpy_version is not None:
                arguments.extend(["--accpy", accpy_version])
            if custom_python is not None:
                arguments.extend(["--python", custom_python])
            
            makenv_process = subprocess.Popen(["/srv/singleuser/bin/makenv", *arguments], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            for line in iter(makenv_process.stdout.readline, b""):
                self.write(f"data: {line.decode('utf-8')}\n\n")
                self.flush()
            
        except Exception as e:
            self.write(f"data: Error: {str(e)}\n\n")
            self.flush()

        self.finish("data: EOF\n\n")


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
