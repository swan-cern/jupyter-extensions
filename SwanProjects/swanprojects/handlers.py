import json
import os
from glob import glob

import tornado
from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join

from swanprojects.utils import ProjectUtils
from swanprojects.config import SwanProjectsConfig
import jupyter_server.serverapp


class BaseHandler(APIHandler):
    def initialize(self, root_dir: str):
        self.swan_config = SwanProjectsConfig(config=self.config)
        self.swan_utils = ProjectUtils(self.contents_manager, self.log, root_dir)


class ProjectsHandler(BaseHandler):
    @tornado.web.authenticated
    def get(self, path):
        project_root = self.swan_utils.get_project_root_path(path)
        project_data = None
        if project_root is not None:
            project_metadata = self.swan_utils.get_project_metadata(project_root)
            project_data = {}
            project_data["name"] = project_root.split(os.path.sep)[-1]
            project_data["user_script"] = self.swan_utils.get_user_script_content(
                project_root
            )
            project_data["full_path"] = project_root
            project_data["stack"] = project_metadata.get("stack")

        allow_project_in_path = True
        if path in self.swan_config.forbidden_project_folders:
            allow_project_in_path = False

        payload = {
            "project_data": project_data,
            "allow_project_in_path": allow_project_in_path,
        }

        self.finish(json.dumps(payload))

    @tornado.web.authenticated
    async def patch(self, path):
        "create or edit a project given a path"
        input_data = super().get_json_body()
        self.log.info(f"editing project {input_data}")
        stack = input_data["stack"]
        user_script = input_data.get("user_script", "")
        data = await self.swan_utils.edit_project(path, stack, user_script)
        self.finish(json.dumps(data))


class SoftwareStacksHandler(BaseHandler):
    @tornado.web.authenticated
    async def get(self):
        """list different software stacks (LCG, CMSSW etc), their release versions and other options"""
        stacks = {}
        for stack in glob(os.path.join(self.swan_config.stacks_path, "*")):
            stack_name = stack.split(os.sep)[-1]
            with open(os.path.join(stack, "config.json")) as f:
                stack_info = json.loads(f.read())
            with open(os.path.join(stack, "logo.svg")) as f:
                stack_logo = f.read()
            stacks[stack_name] = {}
            stacks[stack_name]["logo"] = stack_logo
            stacks[stack_name]["releases"] = stack_info["releases"]

        self.finish(json.dumps({"stacks": stacks}))


def setup_handlers(
    web_app: jupyter_server.serverapp.ServerWebApplication, root_dir: str
):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]  # type: str
    custom_prefix = "swan"

    handlers = [
        (
            url_path_join(base_url, custom_prefix, "projects/(.*)"),
            ProjectsHandler,
            {"root_dir": root_dir},
        ),
        (
            url_path_join(base_url, custom_prefix, "stacks"),
            SoftwareStacksHandler,
            {"root_dir": root_dir},
        ),
    ]
    web_app.add_handlers(host_pattern, handlers)
