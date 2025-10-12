# Copyright (c) SWAN Development Team.
# Author: Omar.Zapata@cern.ch 2021

"""
Customized Kernel Spec Manager that allows handle kernels in multiple environments
for different projects.
"""
import json
import os
import shutil

from jupyter_client.kernelspec import KernelSpecManager, NoSuchKernel
from swanprojects.config import SwanConfig


class SwanKernelSpecManager(KernelSpecManager):
    """
    This class allows to wrap the kernels in the specs to run the kernel
    in multiple environments.
    """

    def __init__(self, **kwargs):
        super(SwanKernelSpecManager, self).__init__(**kwargs)
        self.log.info("JupyterLab swankernelspecmanager is activated!")
        self.project = None
        self.kernel_dirs = []
        self.swan_config = SwanConfig(config=self.config)
        self.swan_utils = None
        self.path = ""

    def set_swan_utils(self, swan_utils):
        """
        Method to set the a SwanUtils class object.
        The class SwanUtils is instatiated in the SwanAPIHandler because it
        requires the contents manager and this class requires those methods to get information
        about the projects.

        Parameters
        ----------
        swan_utils : object
            SwanUtils object required to get projects information.

        """
        self.swan_utils = swan_utils

    def save_native_spec(self, kernel_dir, python_path, display_name):
        """
        This function creates a default kernel with the info from the stack.
        It's necessary for those stacks that don't provide a Python kernel as a JSON file.

        Parameters
        ----------
        kernel_dir : string
            Path to the folder to save the native kernel.
        python_path : string
            Path to the python required for this kernel.
        display_name : string
            Name for the kernel.
        """
        self.log.info(
            f"copying resources from {self.swan_config.kernel_resources} to {kernel_dir}")
        shutil.copytree(self.swan_config.kernel_resources, kernel_dir)
        spec = {"argv": [python_path,
                         "-m",
                         "ipykernel_launcher",
                         "-f",
                         "{connection_file}"
                         ],
                "display_name": display_name,
                "language": "python"
                }
        kernel_file = os.path.join(kernel_dir, "kernel.json")
        self.swan_utils.contents_manager.new({'type': 'file', 'content': json.dumps(
            spec, indent=4), 'format': 'text'}, kernel_file)

    def set_path(self, path):
        """
        This method get a path and check if we are inside the project, if so, then
        the kernel paths for that project is set, otherwise kernel dirs is set to an empty
        list and the kernel are no available anymore for the system.

        Parameters
        ----------
        path : string
            Path to a folder in the SwanFileBrowser.
        """
        self.path = path
        self.project = self.swan_utils.get_project_path(path)
        if self.project is None:
            self.kernel_dirs = []
            return True
        else:
            self.project_info = self.swan_utils.get_project_info(self.project)
            self.project_name = self.swan_utils.get_project_name(self.project)
            if "kernel_dirs" in self.project_info:
                self.kernel_dirs = self.project_info["kernel_dirs"]
                local_kernels = os.path.join(
                    self.project, self.swan_config.kernel_folder_path)
                for version in ["2", "3"]:
                    python = "python" + version
                    if self.project_info[python]["found"] and self.project_info[python]["ipykernel"]:
                        kerne_dir = os.path.join(local_kernels, python)
                        if not self.swan_utils.contents_manager.dir_exists(kerne_dir):
                            self.save_native_spec(
                                kerne_dir, self.project_info[python]["path"], "Python " + version)
                self.kernel_dirs.append(os.path.join(
                    self.swan_utils.contents_manager.root_dir, local_kernels))
                self.log.debug(f"KERNEL DIRS = {self.kernel_dirs}")
                self.log.debug(f"specs:\n {self.get_all_specs()}")
                return True
            else:
                self.log.debug(
                    f"Error setting kernel paths, project {self.project_name} corrupted.")
                self.kernel_dirs = []
                return False

    def wrap_kernel_specs(self, project_path, kspec):
        """
        Helps to wrap the kernels with an extra command to run the kernel inside the project's environment.

        Parameters
        ----------
        project_path : string
            Peth to a project folder.
        kspec : dict
            Kernel spec to wrap

        Returns
        -------
        kspec: dict
            wrapped kernel spec with the required information to run inside the enviroment of the project.
        """
        argv = self.swan_utils.get_env_isolated()
        argv += ["/bin/bash", "-c", "swan_env \"{}\" \"{}\" \"{}\" ".format(
            os.path.join(
                self.swan_utils.contents_manager.root_dir, project_path),
            self.swan_config.stacks_path, ".") + "'" + " ".join(kspec.argv) + "'"
        ]

        kspec.argv = argv
        return kspec

    def get_kernel_spec(self, kernel_name):
        """ Returns a :class:`KernelSpec` instance for the given kernel_name.
            Also, SWAN kernelspecs are generated on the fly
              according to the detected environments.

        Parameters
        ----------
        kernel_name : string
            name of the kernel to check
        Returns
        -------
        kspec: dict
            Spec for the given kernel_name
        """
        kspec = super(SwanKernelSpecManager, self).get_kernel_spec(kernel_name)
        if self.project is None:
            return kspec
        else:
            kspec = self.wrap_kernel_specs(self.project, kspec)
            self.log.debug(f"ON get_kernel_spec = {kspec.argv}")

        return kspec

    def get_all_specs(self):
        """ Returns a dict mapping kernel names to dictionaries with two
            entries: "resource_dir" and "spec". This was added to fill out
            the full public interface to KernelManagerSpec.
        """
        res = {}
        for name, resource_dir in self.find_kernel_specs().items():
            try:
                spec = self.get_kernel_spec(name)
                res[name] = {'resource_dir': resource_dir,
                             'spec': spec.to_dict()}
            except NoSuchKernel:
                self.log.warning(
                    "Error loading kernelspec %r", name, exc_info=True)
        return res
