from tornado import web
import asyncio

from jupyter_server.base.handlers import JupyterHandler, APIHandler
from jupyter_server.utils import url_path_join

import subprocess
from os import path


class SwanCustomEnvironmentsApiHandler(APIHandler):
    """API handler for creating custom environments"""

    # Path to the script used to create custom environments
    makenv_path = path.join(path.dirname(__file__), "scripts/makenv.sh")

    # Path to the file where the log of the makenv.sh script is written
    LOG_FILE = "/tmp/makenv.log"

    makenv_process = None

    @web.authenticated
    async def get(self):
        """
        Gets the arguments from the query string and runs the makenv.sh script with them.
        repo (str): The git URL or absolute unix path to the repository.
        builder (str): The builder used for creating the environment.
        builder_version (str): The version of the specified builder.
        nxcals (bool): Whether to include NXCALS and Spark extensions in the environment.
        """
        self.set_header("Content-Type", "text/event-stream")
        makenv_process = SwanCustomEnvironmentsApiHandler.makenv_process
        
        log_file = None
        if makenv_process is None:
            # The first get request will launch the execution of the makenv.sh script,
            # to create the environment
            makenv_process = self._launch_makenv()
            SwanCustomEnvironmentsApiHandler.makenv_process = makenv_process
            log_file = open(self.LOG_FILE, "w")

        # The first and any subsequent get requests will read from the process
        # and stream out its output
        for line in iter(makenv_process.stdout.readline, b""):
            line = line.decode("utf-8")
            if log_file:
                log_file.write(line)
            self.write(line)
            await self.flush()
            # force a yield so that we can have multiple concurrent executions of get,
            # e.g. from multiple tabs
            await asyncio.sleep(0)

        if log_file:
            log_file.close()

        self.finish()

    def _launch_makenv(self) -> subprocess.Popen:
        repository = self.get_query_argument("repo", default="")
        builder = self.get_query_argument("builder", default="")
        builder_version = self.get_query_argument("builder_version", default="")
        nxcals = self.get_query_argument("nxcals", default="")

        arguments = ["--repo", repository, "--builder", builder]
        if builder_version:
            arguments.extend(("--builder_version", builder_version))
        if nxcals:
            arguments.append("--nxcals")

        return subprocess.Popen([self.makenv_path, *arguments], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


class SwanCustomEnvironmentsHandler(JupyterHandler):
    """Render the custom environment building view"""

    @web.authenticated
    async def get(self):
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
