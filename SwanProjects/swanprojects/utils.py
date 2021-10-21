
# Copyright (c) SWAN Development Team.
# Author: Omar.Zapata@cern.ch 2021

"""
This file has the class SwanUtils with several utility methods
to handle projects and their environments.
"""

from traitlets.config import Configurable
from swanprojects.config import SwanConfig
import json
import os


class SwanUtils(Configurable):

    def __init__(self, contents_manager):
        self.contents_manager = contents_manager
        self.swan_config = SwanConfig(config=self.config)

    def has_project_file(self, path):
        """
        Method to check if .swanproject exists

        Parameters
        ----------
        path : str
            project path.

        Returns
        -------
        bool
            True if the project file .swanprojects was found.
        """
        return self.contents_manager.file_exists(os.path.join(path, self.swan_config.project_file_name))

    def get_project_path(self, path):
        """
        This method returns the project path, the contents_manager._get_project_path function
        returns three possible values 'invalid', None or the path,
        then if it is invalid I return just None to simplify the error control.

        Invalid means for SwanContents a project outside of SWAN_projects folder.

        Parameters
        ----------
        path : str
            A path.

        Returns
        -------
        path: str || None
            The path to the project or None if not project found
        """
        if not path.startswith(os.sep):
            path = os.sep + path  # initial '/' is required by swanconents otherwise it is invalid
        path = self.contents_manager._get_project_path(path)
        if path == 'invalid':
            return None
        else:
            return path

    def get_project_info(self, path):
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
        if self.has_project_file(path):
            swanfile = os.path.join(path, self.swan_config.project_file_name)
            swanfile_model = self.contents_manager.get(swanfile)
            try:
                data = json.loads(swanfile_model['content'])
                return data
            except Exception as e:
                print(e)
                return {}
        else:
            return {}

    def get_user_script_content(self, project_path):
        """
        Returns the content of the user script saved in .user_script file.

        Parameters
        ----------
        path : str
            A path to the project.

        Returns
        -------
        path: str
            The content of the user script or an empty string the the project doesn't have a user script file.
        """
        user_script_path = os.path.join(
            project_path, self.swan_config.userscript_file_name)

        if self.contents_manager.file_exists(user_script_path):
            user_script_path_model = self.contents_manager.get(
                user_script_path)
            return user_script_path_model['content']
        else:
            return ""

    def get_project_name(self, project_path):
        """
        Returns the project name.

        Parameters
        ----------
        path : str
            A path to the project.

        Returns
        -------
        path: str || None
            The name of the project or None is the path provided is not a project.
        """

        path = self.get_project_path(project_path)
        name = None
        if path is not None:
            name = path.split(os.sep)[-1]
        return name

    def check_project_info(self, project_info):
        """
        Allows to check if the .swanproject file content is corrupted.

        Parameters
        ----------
        path : Dict
            Project information such as stack, release, platform etc...

        Returns
        -------
        path: Dict
            Dict with the status and missing fields in case of error.
        """
        project_keys = ["stack", "platform", "release",
                        "user_script", "python3", "python2", "kernel_dirs"]
        not_found = []
        status = True
        for key in project_keys:
            if key not in project_info.keys():
                status = False
                not_found.append(key)
        return {"status": status, "not_found": not_found}

    def get_env_isolated(self):
        """
        Command line required with environment variables to isolate execution.
        """
        command = ["env", "-i", "HOME=%s" % os.environ["HOME"]]
        # checking if we are on EOS to add the env variables
        # we required this to read/write in a isolate environment with EOS
        if "OAUTH2_TOKEN" in os.environ:
            command.append("OAUTH2_TOKEN=%s" % os.environ["OAUTH2_TOKEN"])

        # special case when the package was not installed like root, useful for development
        command.append(
            "PATH=/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin:{}/.local/bin/".format(os.environ["HOME"]))
        command.append(
            "LD_LIBRARY_PATH=/usr/lib:/usr/local/lib"
        )

        return command
