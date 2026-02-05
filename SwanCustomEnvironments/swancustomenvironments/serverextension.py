import os

from tornado import web
from asyncio import sleep
from jinja2 import ChoiceLoader, FileSystemLoader

from jupyter_server.base.handlers import JupyterHandler, APIHandler
from jupyter_server.utils import url_path_join

from subprocess import Popen
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
        repository (str): The git URL or absolute unix path to the repository.
        builder (str): The builder used for creating the environment.
        builder_version (str): The version of the specified builder.
        nxcals (bool): Whether to include NXCALS and Spark extensions in the environment.
        """
        self.set_header("Content-Type", "text/event-stream")
        # makenv_process = SwanCustomEnvironmentsApiHandler.makenv_process
        
        # if makenv_process is None:
        #     makenv_process = self._launch_makenv()
        #     SwanCustomEnvironmentsApiHandler.makenv_process = makenv_process
        self.log.info("Launched makenv.sh script")
        await self._process_log_stream()
        self.finish()

    def _launch_makenv(self) -> Popen:
        """Launches the makenv.sh script as a subprocess."""
        repository = self.get_query_argument("repository", default="")
        builder = self.get_query_argument("builder", default="")
        builder_version = self.get_query_argument("builder_version", default="")
        nxcals = self.get_query_argument("nxcals", default="")

        arguments = ["--repository", repository, "--builder", builder]
        if builder_version:
            arguments.extend(("--builder_version", builder_version))
        if nxcals:
            arguments.append("--nxcals")

        with open(self.LOG_FILE, "w") as log_file:
            return Popen([self.makenv_path, *arguments], stdout=log_file, stderr=log_file)

    async def _process_log_stream(self) -> None:
        """Reads from the log file and streams output to the client."""
        import random
        for line in LOG.splitlines():
             await self._send_line(line + "\n")
             await sleep(random.random() * 5)
        # for _ in range(30):  # Wait for the log file to be created, with a timeout of 30 seconds
        #     self.log.info("Send line to client")
        #     await self._send_line("foo bar\n")
        #     await sleep(1)
        # with open(self.LOG_FILE, "r") as log_file:
        #     while True:
        #         line = log_file.readline()
        #         if not line and makenv_process.poll() is not None:
        #             break  # Process finished, no more logs to read
        #         await self._send_line(line)

    async def _send_line(self, line: str) -> None:
        """Sends a line to the client"""
        if line:
            self.write(line)
            await self.flush()
        # force a yield so that we can have multiple concurrent executions of get,
        # e.g. from multiple tabs
        await sleep(0)


class SwanCustomEnvironmentsHandler(JupyterHandler):
    """Render the custom environment building view"""

    @web.authenticated
    async def get(self):
        is_admin = self.current_user.hub_user.get('admin', False)
        self.write(
            self.render_template(
                "customenvs.html",
                page_title="Creating custom environment",
                hub_prefix="/hub",
                base_url="/hub/",
                logout_url="/hub/logout",
                user=self.current_user,
                parsed_scopes={'admin-ui'} if is_admin else set(),
            )
        )

def _load_jupyter_server_extension(serverapp):
    """
    A server extension that registers the custom environment building API and view
    """

    web_app = serverapp.web_app

    templates_dir = os.path.join(os.path.dirname(__file__), "templates")
    jinja_env = web_app.settings["jinja2_env"]
    jinja_env.loader = ChoiceLoader([
        FileSystemLoader(templates_dir),
        jinja_env.loader,
    ])

    new_handlers = [
        (r"/api/customenvs", SwanCustomEnvironmentsApiHandler),
        (r"/customenvs", SwanCustomEnvironmentsHandler),
    ]

    for handler in new_handlers:
        pattern = url_path_join(web_app.settings["base_url"], handler[0])
        new_handler = tuple([pattern] + list(handler[1:]))
        web_app.add_handlers(".*$", [new_handler])


LOG = """\
Creating environment pyjsx_env using venv (default)...
Setting up the environment...
Installing packages from /eos/user/t/troun/SWAN_projects/pyjsx_1/pyproject.toml...
Processing /eos/user/t/troun/SWAN_projects/pyjsx_1
  Installing build dependencies: started
  Installing build dependencies: finished with status 'done'
  Getting requirements to build wheel: started
  Getting requirements to build wheel: finished with status 'done'
  Preparing metadata (pyproject.toml): started
  Preparing metadata (pyproject.toml): finished with status 'done'
Building wheels for collected packages: python-jsx
  Building wheel for python-jsx (pyproject.toml): started
  Building wheel for python-jsx (pyproject.toml): finished with status 'done'
  Created wheel for python-jsx: filename=python_jsx-0.4.0-py3-none-any.whl size=18094 sha256=769ff525a2630d3228a8971381282356e22942f58632e19a7ffff92ee489d441
  Stored in directory: /tmp/pip-ephem-wheel-cache-_jr9bq20/wheels/4c/d2/cd/21d276b5439d79e6db47563011b5d57bf66b0ce1b706752ef7
Successfully built python-jsx
Installing collected packages: python-jsx
Successfully installed python-jsx-0.4.0

[notice] A new release of pip is available: 24.0 -> 26.0.1
[notice] To update, run: pip install --upgrade pip
Collecting ipykernel==6.29.5
  Downloading ipykernel-6.29.5-py3-none-any.whl.metadata (6.3 kB)
Collecting comm>=0.1.1 (from ipykernel==6.29.5)
  Using cached comm-0.2.3-py3-none-any.whl.metadata (3.7 kB)
Collecting debugpy>=1.6.5 (from ipykernel==6.29.5)
  Downloading debugpy-1.8.20-cp311-cp311-manylinux_2_34_x86_64.whl.metadata (1.4 kB)
Collecting ipython>=7.23.1 (from ipykernel==6.29.5)
  Downloading ipython-9.10.0-py3-none-any.whl.metadata (4.6 kB)
Collecting jupyter-client>=6.1.12 (from ipykernel==6.29.5)
  Using cached jupyter_client-8.8.0-py3-none-any.whl.metadata (8.4 kB)
Collecting jupyter-core!=5.0.*,>=4.12 (from ipykernel==6.29.5)
  Using cached jupyter_core-5.9.1-py3-none-any.whl.metadata (1.5 kB)
Collecting matplotlib-inline>=0.1 (from ipykernel==6.29.5)
  Using cached matplotlib_inline-0.2.1-py3-none-any.whl.metadata (2.3 kB)
Collecting nest-asyncio (from ipykernel==6.29.5)
  Using cached nest_asyncio-1.6.0-py3-none-any.whl.metadata (2.8 kB)
Collecting packaging (from ipykernel==6.29.5)
  Using cached packaging-26.0-py3-none-any.whl.metadata (3.3 kB)
Collecting psutil (from ipykernel==6.29.5)
  Downloading psutil-7.2.2-cp36-abi3-manylinux2010_x86_64.manylinux_2_12_x86_64.manylinux_2_28_x86_64.whl.metadata (22 kB)
Collecting pyzmq>=24 (from ipykernel==6.29.5)
  Using cached pyzmq-27.1.0-cp311-cp311-manylinux_2_26_x86_64.manylinux_2_28_x86_64.whl.metadata (6.0 kB)
Collecting tornado>=6.1 (from ipykernel==6.29.5)
  Using cached tornado-6.5.4-cp39-abi3-manylinux_2_5_x86_64.manylinux1_x86_64.manylinux_2_17_x86_64.manylinux2014_x86_64.whl.metadata (2.8 kB)
Collecting traitlets>=5.4.0 (from ipykernel==6.29.5)
  Using cached traitlets-5.14.3-py3-none-any.whl.metadata (10 kB)
Collecting decorator>=4.3.2 (from ipython>=7.23.1->ipykernel==6.29.5)
  Using cached decorator-5.2.1-py3-none-any.whl.metadata (3.9 kB)
Collecting ipython-pygments-lexers>=1.0.0 (from ipython>=7.23.1->ipykernel==6.29.5)
  Using cached ipython_pygments_lexers-1.1.1-py3-none-any.whl.metadata (1.1 kB)
Collecting jedi>=0.18.1 (from ipython>=7.23.1->ipykernel==6.29.5)
  Using cached jedi-0.19.2-py2.py3-none-any.whl.metadata (22 kB)
Collecting pexpect>4.3 (from ipython>=7.23.1->ipykernel==6.29.5)
  Using cached pexpect-4.9.0-py2.py3-none-any.whl.metadata (2.5 kB)
Collecting prompt_toolkit<3.1.0,>=3.0.41 (from ipython>=7.23.1->ipykernel==6.29.5)
  Using cached prompt_toolkit-3.0.52-py3-none-any.whl.metadata (6.4 kB)
Collecting pygments>=2.11.0 (from ipython>=7.23.1->ipykernel==6.29.5)
  Using cached pygments-2.19.2-py3-none-any.whl.metadata (2.5 kB)
Collecting stack_data>=0.6.0 (from ipython>=7.23.1->ipykernel==6.29.5)
  Using cached stack_data-0.6.3-py3-none-any.whl.metadata (18 kB)
Collecting typing_extensions>=4.6 (from ipython>=7.23.1->ipykernel==6.29.5)
  Using cached typing_extensions-4.15.0-py3-none-any.whl.metadata (3.3 kB)
Collecting python-dateutil>=2.8.2 (from jupyter-client>=6.1.12->ipykernel==6.29.5)
  Using cached python_dateutil-2.9.0.post0-py2.py3-none-any.whl.metadata (8.4 kB)
Collecting platformdirs>=2.5 (from jupyter-core!=5.0.*,>=4.12->ipykernel==6.29.5)
  Using cached platformdirs-4.5.1-py3-none-any.whl.metadata (12 kB)
Collecting parso<0.9.0,>=0.8.4 (from jedi>=0.18.1->ipython>=7.23.1->ipykernel==6.29.5)
  Using cached parso-0.8.5-py2.py3-none-any.whl.metadata (8.3 kB)
Collecting ptyprocess>=0.5 (from pexpect>4.3->ipython>=7.23.1->ipykernel==6.29.5)
  Using cached ptyprocess-0.7.0-py2.py3-none-any.whl.metadata (1.3 kB)
Collecting wcwidth (from prompt_toolkit<3.1.0,>=3.0.41->ipython>=7.23.1->ipykernel==6.29.5)
  Downloading wcwidth-0.5.3-py3-none-any.whl.metadata (30 kB)
Collecting six>=1.5 (from python-dateutil>=2.8.2->jupyter-client>=6.1.12->ipykernel==6.29.5)
  Using cached six-1.17.0-py2.py3-none-any.whl.metadata (1.7 kB)
Collecting executing>=1.2.0 (from stack_data>=0.6.0->ipython>=7.23.1->ipykernel==6.29.5)
  Using cached executing-2.2.1-py2.py3-none-any.whl.metadata (8.9 kB)
Collecting asttokens>=2.1.0 (from stack_data>=0.6.0->ipython>=7.23.1->ipykernel==6.29.5)
  Using cached asttokens-3.0.1-py3-none-any.whl.metadata (4.9 kB)
Collecting pure-eval (from stack_data>=0.6.0->ipython>=7.23.1->ipykernel==6.29.5)
  Using cached pure_eval-0.2.3-py3-none-any.whl.metadata (6.3 kB)
Downloading ipykernel-6.29.5-py3-none-any.whl (117 kB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 117.2/117.2 kB 9.4 MB/s eta 0:00:00
Using cached comm-0.2.3-py3-none-any.whl (7.3 kB)
Downloading debugpy-1.8.20-cp311-cp311-manylinux_2_34_x86_64.whl (3.2 MB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3.2/3.2 MB 77.3 MB/s eta 0:00:00
Downloading ipython-9.10.0-py3-none-any.whl (622 kB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 622.8/622.8 kB 177.1 MB/s eta 0:00:00
Using cached jupyter_client-8.8.0-py3-none-any.whl (107 kB)
Using cached jupyter_core-5.9.1-py3-none-any.whl (29 kB)
Using cached matplotlib_inline-0.2.1-py3-none-any.whl (9.5 kB)
Using cached pyzmq-27.1.0-cp311-cp311-manylinux_2_26_x86_64.manylinux_2_28_x86_64.whl (857 kB)
Using cached tornado-6.5.4-cp39-abi3-manylinux_2_5_x86_64.manylinux1_x86_64.manylinux_2_17_x86_64.manylinux2014_x86_64.whl (445 kB)
Using cached traitlets-5.14.3-py3-none-any.whl (85 kB)
Using cached nest_asyncio-1.6.0-py3-none-any.whl (5.2 kB)
Using cached packaging-26.0-py3-none-any.whl (74 kB)
Downloading psutil-7.2.2-cp36-abi3-manylinux2010_x86_64.manylinux_2_12_x86_64.manylinux_2_28_x86_64.whl (155 kB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 155.6/155.6 kB 64.0 MB/s eta 0:00:00
Using cached decorator-5.2.1-py3-none-any.whl (9.2 kB)
Using cached ipython_pygments_lexers-1.1.1-py3-none-any.whl (8.1 kB)
Using cached jedi-0.19.2-py2.py3-none-any.whl (1.6 MB)
Using cached pexpect-4.9.0-py2.py3-none-any.whl (63 kB)
Using cached platformdirs-4.5.1-py3-none-any.whl (18 kB)
Using cached prompt_toolkit-3.0.52-py3-none-any.whl (391 kB)
Using cached pygments-2.19.2-py3-none-any.whl (1.2 MB)
Using cached python_dateutil-2.9.0.post0-py2.py3-none-any.whl (229 kB)
Using cached stack_data-0.6.3-py3-none-any.whl (24 kB)
Using cached typing_extensions-4.15.0-py3-none-any.whl (44 kB)
Using cached asttokens-3.0.1-py3-none-any.whl (27 kB)
Using cached executing-2.2.1-py2.py3-none-any.whl (28 kB)
Using cached parso-0.8.5-py2.py3-none-any.whl (106 kB)
Using cached ptyprocess-0.7.0-py2.py3-none-any.whl (13 kB)
Using cached six-1.17.0-py2.py3-none-any.whl (11 kB)
Using cached pure_eval-0.2.3-py3-none-any.whl (11 kB)
Downloading wcwidth-0.5.3-py3-none-any.whl (92 kB)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 93.0/93.0 kB 39.8 MB/s eta 0:00:00
Installing collected packages: pure-eval, ptyprocess, wcwidth, typing_extensions, traitlets, tornado, six, pyzmq, pygments, psutil, platformdirs, pexpect, parso, packaging, nest-asyncio, executing, decorator, debugpy, comm, asttokens, stack_data, python-dateutil, prompt_toolkit, matplotlib-inline, jupyter-core, jedi, ipython-pygments-lexers, jupyter-client, ipython, ipykernel
Successfully installed asttokens-3.0.1 comm-0.2.3 debugpy-1.8.20 decorator-5.2.1 executing-2.2.1 ipykernel-6.29.5 ipython-9.10.0 ipython-pygments-lexers-1.1.1 jedi-0.19.2 jupyter-client-8.8.0 jupyter-core-5.9.1 matplotlib-inline-0.2.1 nest-asyncio-1.6.0 packaging-26.0 parso-0.8.5 pexpect-4.9.0 platformdirs-4.5.1 prompt_toolkit-3.0.52 psutil-7.2.2 ptyprocess-0.7.0 pure-eval-0.2.3 pygments-2.19.2 python-dateutil-2.9.0.post0 pyzmq-27.1.0 six-1.17.0 stack_data-0.6.3 tornado-6.5.4 traitlets-5.14.3 typing_extensions-4.15.0 wcwidth-0.5.3

[notice] A new release of pip is available: 24.0 -> 26.0.1
[notice] To update, run: pip install --upgrade pip
Installed kernelspec pyjsx_env in /home/troun/pyjsx_env/share/jupyter/kernels/pyjsx_env
REPO_PATH:/SWAN_projects/pyjsx_1
"""
