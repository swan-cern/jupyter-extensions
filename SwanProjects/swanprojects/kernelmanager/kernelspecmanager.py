# Copyright (c) SWAN Development Team.
# Author: Omar.Zapata@cern.ch 2021

import json
import os
import shutil

from jupyter_client.kernelspec import KernelSpecManager, NoSuchKernel
from swanprojects.utils import (get_project_info, get_project_name,
                                get_project_path, get_env_isolated)
from traitlets import Unicode
from traitlets.config import Configurable


class SwanKSMConfig(Configurable):
    kernel_resources = Unicode(
        os.path.dirname(os.path.abspath(__file__)) + '/resources',
        config=True,
        help="The path to the folder containg the resources to add to the kernel"
    )


class SwanKernelSpecManager(KernelSpecManager):
    path = Unicode("", config=True, allow_none=True,
                   help="SWAN Project path")

    def __init__(self, **kwargs):
        super(SwanKernelSpecManager, self).__init__(**kwargs)
        self.log.info("JupyterLab swankernelspecmanager is activated!")
        self.project = None
        self.kernel_dirs = []
        self.ksmconfig = SwanKSMConfig(config=self.config)

    def save_native_spec(self, kernel_dir, python_path, display_name):
        """
        This function creates a default kernel with the info from the stack.
        It's necessary for CMSSW stacks and those that don't provide a Python kernel as a JSON file.
        """
        self.log.info(
            f"copying resources from {self.ksmconfig.kernel_resources} to {kernel_dir}")
        shutil.copytree(self.ksmconfig.kernel_resources, kernel_dir)
        spec = {"argv": [python_path,
                         "-m",
                         "ipykernel_launcher",
                         "-f",
                         "{connection_file}"
                         ],
                "display_name": display_name,
                "language": "python"
                }
        kernel_file = kernel_dir + "/kernel.json"
        f = open(kernel_file, "w+")
        json.dump(spec, f, indent=4)
        f.close()

    def set_path(self, path):
        self.path = path
        self.project = get_project_path(path)
        if self.project is None:
            self.kernel_dirs = []
            return True
        else:
            self.project_info = get_project_info(self.project)
            self.project_name = get_project_name(self.project)
            if "kernel_dirs" in self.project_info:
                self.kernel_dirs = self.project_info["kernel_dirs"]
                local_kernels = self.project + "/.local/share/jupyter/kernels/"
                for version in ["2", "3"]:
                    python = "python" + version
                    if self.project_info[python]["found"] and self.project_info[python]["ipykernel"]:
                        kerne_dir = local_kernels + python
                        if not os.path.exists(kerne_dir):
                            self.save_native_spec(
                                kerne_dir, self.project_info[python]["path"], "Python " + version)
                self.kernel_dirs.append(local_kernels)
                self.log.debug(f"KERNEL DIRS = {self.kernel_dirs}")
                self.log.debug(f"specs:\n {self.get_all_specs()}")
                return True
            else:
                self.log.debug(
                    f"Error setting kernel paths, project {self.project_name} corrupted.")
                self.kernel_dirs = []
                return False

    def wrap_kernel_specs(self, project_name, kspec):

        argv = get_env_isolated()
        argv += ["/bin/bash", "-c", "swan_env {} {} ".format(
            project_name, ".") + "'" + " ".join(kspec.argv) + "'"
        ]

        kspec.argv = argv
        return kspec

    def find_kernel_specs(self, skip_base=True):
        """ Returns a dict mapping kernel names to resource directories.
            The update process also adds the resource dir for the SWAN
            environments.
        """
        kspecs = super(SwanKernelSpecManager, self).find_kernel_specs()
        return kspecs

    def get_kernel_spec(self, kernel_name):
        """ Returns a :class:`KernelSpec` instance for the given kernel_name.
            Also, SWAN kernelspecs are generated on the fly
              according to the detected environments.
        """
        kspec = super(SwanKernelSpecManager, self).get_kernel_spec(kernel_name)
        if self.project is None:
            return kspec
        else:
            kspec = self.wrap_kernel_specs(self.project_name, kspec)
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
