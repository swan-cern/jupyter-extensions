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
        repo_type (str): The type of repository (git or eos).
        builder (str): The builder used for creating the environment.
        builder_version (str): The version of the specified builder.
        """
        self.set_header("Content-Type", "text/event-stream")

        repository = self.get_query_argument("repo", default="")
        repo_type = self.get_query_argument("repo_type", default="")
        builder = self.get_query_argument("builder", default="")
        builder_version = self.get_query_argument("builder_version", default="")

        arguments = ["--repo", repository, "--repo_type", repo_type, "--builder", builder, "--builder_version", builder_version]
        makenv_process = subprocess.Popen([self.makenv_path, *arguments], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

        for line in iter(makenv_process.stdout.readline, b""):
            self.write(line.decode('utf-8'))
            self.flush()

        self.finish()


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
