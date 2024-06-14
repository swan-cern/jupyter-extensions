from tornado import web

from jupyter_server.base.handlers import JupyterHandler, APIHandler
from jupyter_server.utils import url_path_join

import subprocess
from os import path


class SwanCustomEnvironmentsApiHandler(APIHandler):
    """API handler for creating custom environments"""

    # Path to the script used to create custom environments
    makenv_path = path.join(path.dirname(__file__), "scripts/makenv.sh")

    @web.authenticated
    def get(self):
        """
        Gets the arguments from the query string and runs the makenv.sh script with them.
        repo (str): The git URL or absolute unix path to the repository.
        accpy (str): The version of Accpy to be installed in the environment (optional).
        """
        self.set_header("Content-Type", "text/event-stream")

        repository = self.get_query_argument("repo", default=None)
        accpy_version = self.get_query_argument("accpy", default=None)

        arguments = ["--repo", repository]
        if accpy_version is not None:
            arguments.extend(["--accpy", accpy_version])
        
        makenv_process = subprocess.Popen([self.makenv_path, *arguments], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        
        for line in iter(makenv_process.stdout.readline, b""):
            self.write(f"data: {line.decode('utf-8')}\n\n")
            self.flush()
            
        self.finish("data: EOF\n\n")


class SwanCustomEnvironmentsHandler(JupyterHandler):
    """Render the custom environment building view"""

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
    A server extension that registers the custom environment building API and view
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
