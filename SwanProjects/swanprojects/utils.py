from logging import Logger
from typing import Any, Union, TypedDict
import os
import json
import pathlib
import asyncio

from traitlets.config import Configurable
from swanprojects.config import SwanProjectsConfig
from notebook.services.contents.manager import ContentsManager


class SoftwareStack(TypedDict):
    type: str
    release: str
    platform: str
    user_script: str


class ProjectUtils(Configurable):
    def __init__(self, contents_manager: ContentsManager, log: Logger, root_dir: str):
        self.contents_manager = contents_manager
        self.swan_config = SwanProjectsConfig(config=self.config)
        self.log = log
        self.root_dir = root_dir

    def has_project_file(self, project_folder_path: str) -> bool:
        """Method to check if a swanproject file exists"""
        return self.contents_manager.file_exists(
            os.path.join(project_folder_path, self.swan_config.project_file_name)
        )

    def get_project_root_path(self, folder_path: str) -> Union[str, None]:
        """Return path of project that folder_path belongs to, or None"""
        path = pathlib.PurePath(folder_path)
        # recursively traverse parent folders to check if any are a project
        for parent in [path, *path.parents]:
            if parent == ".":
                # jupyter represents the server root api_path with empty string to query contents API
                parent = ""
            if self.has_project_file(str(parent)):
                return str(parent)

        # If path is not inside any project
        return None

    def get_project_metadata(self, folder_path: str):
        """
        This method returns the project info such as stack, release, platform etc..

        Parameters
        ----------
        path : str
            A path to the project.

        Returns
        -------
        path: Dict || None
            Project information in a dictionary or a empty dictionary in case of error.
        """
        if self.has_project_file(folder_path):
            swanfile_model = self.contents_manager.get(
                os.path.join(folder_path, self.swan_config.project_file_name)
            )
            try:
                data = json.loads(swanfile_model["content"])
                return data
            except Exception as e:
                print(e)
                return {}
        else:
            return {}

    async def edit_project(
        self, folder_path: str, stack: SoftwareStack, user_script: str
    ):

        project_folder_path = self.get_project_root_path(folder_path) or folder_path
        if project_folder_path is None:
            project_folder_path = folder_path

        if folder_path in self.swan_config.forbidden_project_folders:
            return {
                "status": True,
                "errorMessage": f"Cannot set a custom enviornment for {folder_path or 'home directory'}",
            }

        if self.contents_manager.file_exists(project_folder_path):
            return {
                "status": False,
                "errorMessage": f"There is already a file in {project_folder_path}",
            }

        if not self.contents_manager.dir_exists(project_folder_path):
            return {
                "status": False,
                "errorMessage": f"The folder {project_folder_path} does not exist",
            }

        try:
            await self._generate_folder_environment(project_folder_path, stack)
        except Exception as e:
            return {
                "status": False,
                "errorMessage": f"Failed to generate environment for folder {e}",
            }

        try:
            await self._save_user_script_file(project_folder_path, user_script)
        except Exception as e:
            return {
                "status": False,
                "errorMessage": f"Failed to write custom script to folder {e}",
            }

        try:
            self._save_enviornment_metadata_file(project_folder_path, stack)
        except Exception as e:
            print(e)
            return {
                "status": False,
                "errorMessage": "An unknown error occured writing the enviornment metadata",
            }

        return {"status": True}

    async def _generate_folder_environment(
        self, project_folder_path: str, stack: SoftwareStack
    ):
        if stack["type"] == "default":
            environment_file_path = os.path.join(
                project_folder_path, self.swan_config.environment_file_name
            )
            if self.contents_manager.file_exists(environment_file_path):
                self.contents_manager.delete_file(environment_file_path)

            return

        stacks_folder = pathlib.Path(self.swan_config.stacks_path)
        setup_script_path = stacks_folder / stack["type"] / "setup.sh"

        if not setup_script_path.is_file():
            stacks_folder = str(stacks_folder / stack["type"])
            raise Exception(f"Unknown software stack type.")
        pass_through_env = {
            variable: os.environ.get(variable)
            for variable in self.swan_config.environment_pass_through_variables
        }
        process = await asyncio.create_subprocess_exec(
            "/bin/bash",
            "--noprofile",
            "--norc",
            "-c",
            f"source '{setup_script_path}' && printenv",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={
                "RELEASE": stack.get("release"),
                "PLATFORM": stack.get("platform"),
                "SWAN_PROJECT_PATH": os.path.join(
                    os.path.abspath(self.root_dir), project_folder_path
                ),
                **pass_through_env,
            },
        )
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            self.log.error(
                f"RETURNCODE: {process.returncode}, STDOUT:\n {stdout}\n, STDERR: \nf{stderr}\n"
            )
            raise Exception(
                f"Error generating environment with output {stdout}, {stderr}, {process.returncode}"
            )
        self._save_environment_lock_file(project_folder_path, stdout.decode("utf-8"))

    def _save_environment_lock_file(self, project_folder_path: str, environment: str):
        environment_file_path = os.path.join(
            project_folder_path, self.swan_config.environment_file_name
        )
        model = {
            "name": self.swan_config.environment_file_name,
            "path": environment_file_path,
            "type": "file",
            "content": environment,
            "format": "text",
        }
        self.contents_manager.save(model, environment_file_path)

    def _save_enviornment_metadata_file(self, project_folder_path: str, stack: Any):
        metadata_file_path = os.path.join(
            project_folder_path, self.swan_config.project_file_name
        )
        if stack["type"] == "default":
            if  self.contents_manager.file_exists(metadata_file_path):
                self.contents_manager.delete_file(metadata_file_path)
        else:
            model = {
                "name": self.swan_config.project_file_name,
                "path": metadata_file_path,
                "type": "file",
                "content": json.dumps({"stack": stack}),
                "format": "text",
            }
            self.contents_manager.save(model, metadata_file_path)

    def _save_user_script_file(self, project_folder_path: str, user_script: str):
        user_script_file_path = os.path.join(
            project_folder_path, self.swan_config.project_file_name
        )
        if not user_script and self.contents_manager.file_exists(user_script_file_path):
            # If the script was removed, delete any existing file
            self.contents_manager.delete_file(user_script_file_path)
        else:
            model = {
                "name": self.swan_config.project_file_name,
                "path": user_script_file_path,
                "type": "file",
                "content": user_script,
                "format": "text",
            }
            self.contents_manager.save(model, user_script_file_path)

    def get_user_script_content(self, project_folder_path: str):
        """Returns the content of the user script saved in .user_script file or empty string"""
        user_script_path = os.path.join(
            project_folder_path, self.swan_config.userscript_file_name
        )

        if self.contents_manager.file_exists(user_script_path):
            user_script_path_model = self.contents_manager.get(user_script_path)
            return user_script_path_model["content"]
        else:
            return ""
