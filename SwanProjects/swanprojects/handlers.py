# Copyright (c) SWAN Development Team.
# Author: Omar.Zapata@cern.ch 2021
import json
import os
import shutil
import subprocess

import tornado
from notebook.base.handlers import APIHandler
from notebook.utils import url_path_join
from tornado.web import StaticFileHandler
from traitlets import Unicode
from traitlets.config import Configurable

from .utils import (get_project_info, get_project_path, get_project_readme,
                    get_user_script_content, get_env_isolated)

class SwanProjects(Configurable):
    stacks_path = Unicode(
        os.path.dirname(os.path.abspath(__file__)) + '/stacks.json',
        config=True,
        help="The path to the JSON containing stack configuration")

class ProjectInfoHandler(APIHandler):
    @tornado.web.authenticated
    def post(self):
        """
        Post request for the SwanLauncher/SwanFileBrowser,
        this endpoint returns project information such as stack, release, platform etc..
        if the path is not inside the project return and empty project data.
        """
        input_data = self.get_json_body()
        self.log.info(f"ProjectInfoHandler = {input_data}")
        path = input_data["path"]

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

class StacksInfoHandler(APIHandler):

    swan_projects_config = None

    def initialize(self):
        self.swan_projects_config = SwanProjects(config=self.config)

    @tornado.web.authenticated
    def get(self):
        """
        This endpoint is required for the project dialog, it's returning the information saved on stacks.json
        """
        with open(self.swan_projects_config.stacks_path) as f:
            stacks = json.loads(f.read())
        self.finish(json.dumps({"stacks": stacks}))

class KernelSpecManagerPathHandler(APIHandler):
    @tornado.web.authenticated
    def post(self):
        """
        This endpoint is required for the project kernel spec manager, it's it is setting the path to
        check if we are inside a project to change the kernel spec manager path
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

class CreateProjectHandler(APIHandler):
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

        project_dir = os.environ["HOME"] + "/SWAN_projects/" + name
        try:
            os.makedirs(project_dir)
        except Exception as msg:
            data = {"status": False, "project_dir": f"SWAN_projects/{name}",
                    "msg": f"Error creating folder for project {name}, traceback: {msg}"}
            self.finish(json.dumps(data))
            return
        swan_project_file = project_dir + os.path.sep + '.swanproject'
        swan_project_content = {'stack': stack, 'release': release,
                                'platform': platform}
        try:
            with open(swan_project_file, 'w+') as f:
                f.write(json.dumps(swan_project_content,
                        indent=4, sort_keys=True))
                f.close()
        except Exception as msg:
            data = {"status": False, "project_dir": f"SWAN_projects/{name}",
                    "msg": f"Error creating .swanproject file for project {name}, traceback: {msg}"}
            self.finish(json.dumps(data))
            return

        try:
            swan_user_script_file = project_dir + os.path.sep + '.userscript'
            with open(swan_user_script_file, 'w') as f:
                f.write(user_script)
                f.close()
        except Exception as msg:
            data = {"status": False, "project_dir": f"SWAN_projects/{name}",
                    "msg": f"Error creating .userscript file for project {name}, traceback: {msg}"}
            self.finish(json.dumps(data))
            return

        command = get_env_isolated()
        command += ["/bin/bash", "-c", "swan_kmspecs --project_name %s" % name]
        self.log.info(f"running {command} ")
        proc = subprocess.Popen(command, stdout=subprocess.PIPE)
        proc.wait()
        output = proc.stdout.read().decode("utf-8")
        self.log.info(f"swan_kmspecs output: {output}")
        proc.communicate()
        self.log.info(f"swan_kmspecs return code: {proc.returncode}")
        if proc.returncode != 0:
            data = {"status": False, "project_dir": f"SWAN_projects/{name}",
                    "msg": f"Error collecting the information from cvmfs for project {name},  traceback: {output}"}
            self.finish(json.dumps(data))
            return

        data = {"status": True, "project_dir": f"SWAN_projects/{name}",
                "msg": f"created project {name}"}
        self.finish(json.dumps(data))

class EditProjectHandler(APIHandler):

    @tornado.web.authenticated
    def post(self):
        """
        This endpoint allows to edit project information, such as name, stack, platform etc..
        The project can be renamed from $HOME/SWAN_projects/old_name to $HOME/SWAN_projects/name
        and metadata in the .swanproject is updated.

        This endpoint allows also edit corrupted projects, if something is wrong in .swanproject
        the edit project dialog will send the information again to this endpoint to fix the project information.
        """
        input_data = self.get_json_body()
        print(f"EditProjectHandler = {input_data}")

        corrupted = False
        if "corrupted" in input_data.keys():
            corrupted = input_data["corrupted"]

        old_name = ""
        if "old_name" in input_data.keys():
            old_name = input_data["old_name"]

        old_stack = ""
        if "old_stack" in input_data.keys():
            old_stack = input_data["old_stack"]

        old_platform = ""
        if "old_platform" in input_data.keys():
            old_platform = input_data["old_platform"]

        old_release = ""
        if "old_release" in input_data.keys():
            old_release = input_data["old_release"]

        old_userscript = ""
        if "old_userscript" in input_data.keys():
            old_userscript = input_data["old_userscript"]

        name = input_data["name"]
        stack = input_data["stack"]
        platform = input_data["platform"]
        release = input_data["release"]
        user_script = input_data["user_script"]

        project_dir = os.environ["HOME"] + "/SWAN_projects/" + name
        if old_name != name:
            try:
                old_project_dir = os.environ["HOME"] + \
                    "/SWAN_projects/" + old_name
                os.rename(old_project_dir, project_dir)
            except Exception as msg:
                data = {"status": False, "project_dir": f"SWAN_projects/{old_name}",
                        "msg": f"Error editing project folder {old_name},  traceback: {msg}"}
                # this will stop the execution here, it's the same for the next exceptions.
                self.finish(json.dumps(data))
                return

        if old_userscript != user_script:
            userscript_file = project_dir + os.path.sep + '.userscript'
            try:
                with open(userscript_file, 'w') as f:
                    f.write(user_script)
                    f.close()
            except Exception as msg:
                data = {"status": False, "project_dir": f"SWAN_projects/{name}",
                        "msg": f"Error editing .userscript for project {name},  traceback: {msg}"}
                self.finish(json.dumps(data))
                return

        if stack != old_stack or platform != old_platform or release != old_release or corrupted:
            swan_project_file = project_dir + os.path.sep + '.swanproject'
            swan_project_content = {'stack': stack, 'release': release,
                                    'platform': platform}
            kernel_dir = project_dir + "/.local/share/jupyter/kernels"

            # removing old native kernels for python only(this is generated by us)
            if os.path.exists(kernel_dir + "/python2"):
                shutil.rmtree(kernel_dir + "/python2")

            if os.path.exists(kernel_dir + "/python3"):
                shutil.rmtree(kernel_dir + "/python3")

            with open(swan_project_file, 'w+') as f:
                f.write(json.dumps(swan_project_content,
                        indent=4, sort_keys=True))
                f.close()
            command = get_env_isolated()
            command += ["swan_kmspecs", "--project_name", name]
            self.log.info(f"running {command} ")
            proc = subprocess.Popen(command, stdout=subprocess.PIPE)
            proc.wait()
            output = proc.stdout.read().decode("utf-8")
            self.log.info(f"result {output} ")
            proc.communicate()
            self.log.info(f"swan_kmspecs return code: {proc.returncode}")
            if proc.returncode != 0:
                data = {"status": False, "project_dir": f"SWAN_projects/{name}",
                        "msg": f"Error editing stack, platform or release for project {name},  traceback: {output}"}
                self.finish(json.dumps(data))
                return
        data = {"status": True, "project_dir": f"SWAN_projects/{name}",
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
