# Copyright (c) SWAN Development Team.
# Author: Omar.Zapata@cern.ch 2021
import json
import os
import shutil
import subprocess
from glob import glob

import tornado
from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
from tornado.web import StaticFileHandler

from .utils import (get_project_info, get_project_path, get_project_readme,
                    get_user_script_content, get_env_isolated)

from swanprojects.config import SwanConfig


class SwanAPIHandler(APIHandler):
    swan_config = None

    def initialize(self):
        """
        Initialization of the handler with the swan configuration object.
        """
        self.swan_config = SwanConfig(config=self.config)

    def subprocess(self, command):
        """
        Method to call a sub process in a isolated environment

        Parameters
        ----------
        command : list
            commands to execute in the isolated environment.

        Returns
        -------
        Popen
            object to get information from the executed process such as output and return code.
        """
        command = get_env_isolated() + command
        self.log.info(f"running {command} ")
        proc = subprocess.Popen(
            command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        proc.wait()
        stdout = proc.stdout.read().decode("utf-8")
        stderr = proc.stderr.read().decode("utf-8")
        proc.communicate()
        self.log.info(f"result stdout: {stdout} ")
        self.log.info(f"result stderr: {stderr} ")
        return (stderr, proc.returncode)


class ProjectInfoHandler(SwanAPIHandler):
    @tornado.web.authenticated
    def get(self):
        """
        Get request for the SwanLauncher/SwanFileBrowser,
        this endpoint returns project information such as stack, release, platform etc..
        if the path is not inside the project return and empty project data.
        """
        path = self.get_argument('path')
        caller = self.get_argument('caller')
        self.log.info(f"ProjectInfoHandler caller = {caller} path = {path}")

        project = get_project_path(path)
        project_data = {}
        if project is not None:
            project_data = get_project_info(project)

            project_data["name"] = project.split(os.path.sep)[-1]
            readme = get_project_readme(project)
            if readme is not None:
                project_data["readme"] = readme
            project_data["user_script"] = get_user_script_content(project)
        payload = {"project_data": project_data}
        self.finish(json.dumps(payload))


class StacksInfoHandler(SwanAPIHandler):
    @tornado.web.authenticated
    def get(self):
        """
        This endpoint is required for the project dialog, it's returning the information saved on stacks.json
        """
        stacks = {}
        stacks["path"] = self.swan_config.stacks_path
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


class KernelSpecManagerPathHandler(SwanAPIHandler):
    @tornado.web.authenticated
    def post(self):
        """
        This endpoint is required for the project kernel spec manager, it's setting the path to
        check if we are inside a project to change the kernel spec manager path.
        """
        input_data = self.get_json_body()
        path = input_data["path"]

        self.log.info(f"KernelSpecManagerPathHandler = {input_data}")

        project = get_project_path(path)
        if self.kernel_spec_manager.set_path(path):
            data = {"status": True, "is_project": project is not None,
                    "msg": f"SWAN kernel spec manager set to path: {path}"}
            self.finish(json.dumps(data))
        else:
            data = {"status": False, "is_project": project is not None,
                    "msg": f"Error setting SWAN kernel spec manager to path: {path}"}
            self.finish(json.dumps(data))


class CreateProjectHandler(SwanAPIHandler):
    @tornado.web.authenticated
    def post(self):
        """
        Endpoint to create a project, receive project information such as name, stack, platform, release, user_script.
        The project is created at $HOME/SWAN_projects/project_name and a hidden json ".swanproject" file with the information
        project is set inside the project folder.
        """
        input_data = self.get_json_body()
        self.log.info(f"creating project {input_data}")

        name = input_data["name"]
        stack = input_data["stack"]  # CMSSW/LCG
        platform = input_data["platform"]  # SCRAM/x86_64..centos7..gccX
        release = input_data["release"]  # CMSSW_X_Y_Z/LCG_XYZ
        user_script = input_data["user_script"]
        project_relative_dir = os.path.join(
            self.swan_config.projects_folder_name, name)
        try:
            self.contents_manager.new({'type':'directory'},project_relative_dir)
        except Exception as msg:
            data = {"status": False, "project_dir": project_relative_dir,
                    "msg": f"Error creating folder for project {name}, traceback: {msg}"}
            self.finish(json.dumps(data))
            return
        swan_project_file = os.path.join(
            project_relative_dir, self.swan_config.project_file_name)
        swan_project_content = {'stack': stack, 'release': release,
                                'platform': platform}
        try:
            self.contents_manager.new({'type':'file','content':json.dumps(swan_project_content,
                        indent=4, sort_keys=True),'format':'text'},swan_project_file)
        except Exception as msg:
            data = {"status": False, "project_dir": project_relative_dir,
                    "msg": f"Error creating {self.swan_config.project_file_name} file for project {name}, traceback: {msg}"}
            self.finish(json.dumps(data))
            return

        try:
            swan_user_script_file = os.path.join(
                project_relative_dir, self.swan_config.userscript_file_name)
            self.contents_manager.new({'type':'file','content':user_script,'format':'text'},swan_user_script_file)
        except Exception as msg:
            data = {"status": False, "project_dir": project_relative_dir,
                    "msg": f"Error creating {self.swan_config.userscript_file_name} file for project {name}, traceback: {msg}"}
            self.finish(json.dumps(data))
            return
        command = ["/bin/bash", "-c",
                   f"swan_kmspecs --project_name {name} --stacks_path {self.swan_config.stacks_path}"]
        stderr, returncode = self.subprocess(command)
        self.log.info(f"swan_kmspecs return code: {returncode}")
        if returncode != 0:
            data = {"status": False, "project_dir": project_relative_dir,
                    "msg": f"Error collecting the information from cvmfs for project {name},  traceback: {stderr}"}
            self.finish(json.dumps(data))
            return

        data = {"status": True, "project_dir": project_relative_dir,
                "msg": f"created project {name}"}
        self.finish(json.dumps(data))


class EditProjectHandler(SwanAPIHandler):

    @tornado.web.authenticated
    def put(self):
        """
        This endpoint allows to edit project information, such as name, stack, platform etc..
        The project can be renamed from $HOME/SWAN_projects/old_name to $HOME/SWAN_projects/name
        and metadata in the .swanproject is updated.

        This endpoint allows also edit corrupted projects, if something is wrong in .swanproject
        the edit project dialog will send the information again to this endpoint to fix the project information.
        """
        input_data = self.get_json_body()
        self.log.info(f"EditProjectHandler = {input_data}")

        corrupted = input_data.get("corrupted")
        old_name = input_data.get("old_name")
        old_stack = input_data.get("old_stack")
        old_platform = input_data.get("old_platform")
        old_release = input_data.get("old_release")
        old_userscript = input_data.get("old_userscript")

        name = input_data["name"]
        stack = input_data["stack"]
        platform = input_data["platform"]
        release = input_data["release"]
        user_script = input_data["user_script"]

        project_relative_dir = os.path.join(
            self.swan_config.projects_folder_name, name)
        if old_name != name:
            try:
                old_project_dir = os.path.join(
                    self.swan_config.projects_folder_name, old_name)
                self.contents_manager.rename(old_project_dir, project_relative_dir)
            except Exception as msg:
                data = {"status": False, "project_dir": project_relative_dir,
                        "msg": f"Error editing project folder {old_name},  traceback: {msg}"}
                # this will stop the execution here, it's the same for the next exceptions.
                self.finish(json.dumps(data))
                return

        if old_userscript != user_script:
            try:
                swan_user_script_file = os.path.join(
                project_relative_dir, self.swan_config.userscript_file_name)
                self.contents_manager.new({'type':'file','content':user_script,'format':'text'},swan_user_script_file)
            except Exception as msg:
                data = {"status": False, "project_dir": project_relative_dir,
                        "msg": f"Error editing {self.swan_config.userscript_file_name} for project {name},  traceback: {msg}"}
                self.finish(json.dumps(data))
                return

        if stack != old_stack or platform != old_platform or release != old_release or corrupted:
            swan_project_file = os.path.join(
                project_relative_dir, self.swan_config.project_file_name)
            swan_project_content = {'stack': stack, 'release': release,
                                    'platform': platform}
            kernel_dir = project_relative_dir + "/.local/share/jupyter/kernels"
            kernel_dir_python2 = os.path.join(kernel_dir,'python2')
            kernel_dir_python3 = os.path.join(kernel_dir,'python3')

            # removing old native kernels for python only(this is generated by us)
            if os.path.exists(kernel_dir_python2):
                shutil.rmtree(kernel_dir_python2)

            if os.path.exists(kernel_dir_python3):
                shutil.rmtree(kernel_dir_python3)

            self.contents_manager.new({'type':'file','content':json.dumps(swan_project_content,
                        indent=4, sort_keys=True),'format':'text'},swan_project_file)
            command = ["swan_kmspecs", "--project_name", name,
                       "--stacks_path", self.swan_config.stacks_path]
            stderr, returncode = self.subprocess(command)
            self.log.info(f"swan_kmspecs return code: {returncode}")
            if returncode != 0:
                data = {"status": False, "project_dir": project_relative_dir,
                        "msg": f"Error editing stack, platform or release for project {name},  traceback: {stderr}"}
                self.finish(json.dumps(data))
                return
        data = {"status": True, "project_dir": project_relative_dir,
                "msg": f"edited project {name}"}
        self.finish(json.dumps(data))

# URL to handler mappings


def setup_handlers(web_app, url_path):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    # Prepend the base_url so that it works in a jupyterhub setting
    create_pattern = url_path_join(base_url, url_path, "project/create")
    edit_pattern = url_path_join(base_url, url_path, "project/edit")
    project_pattern = url_path_join(base_url, url_path, "project/info")
    stack_pattern = url_path_join(base_url, url_path, "stacks/info")
    ksm_path_pattern = url_path_join(base_url, url_path, "kernelspec/set")

    handlers = [(create_pattern, CreateProjectHandler)]
    handlers.append((edit_pattern, EditProjectHandler))
    handlers.append((project_pattern, ProjectInfoHandler))
    handlers.append((stack_pattern, StacksInfoHandler))
    handlers.append((ksm_path_pattern, KernelSpecManagerPathHandler))

    web_app.add_handlers(host_pattern, handlers)

    # Prepend the base_url so that it works in a jupyterhub setting
    doc_url = url_path_join(base_url, url_path, "static")
    doc_dir = os.getenv(
        "SWAN_JLAB_SERVER_STATIC_DIR",
        os.path.join(os.path.dirname(__file__), "static"),
    )
    handlers = [("{}/(.*)".format(doc_url),
                 StaticFileHandler, {"path": doc_dir})]
    web_app.add_handlers(".*$", handlers)
