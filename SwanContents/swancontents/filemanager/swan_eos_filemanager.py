# from notebook import transutils #needs to be imported before Jupyter File Manager
from jupyter_server.services.contents.largefilemanager import LargeFileManager
from .eos.fileio import SwanFileManagerMixin
from .eos.handlers import SwanAuthenticatedFileHandler
from .projects_mixin import ProjectsMixin
from ..checkpoints.eoscheckpoints import EOSCheckpoints
from traitlets import default
import os
import shutil


class SwanEosFileManager(ProjectsMixin, SwanFileManagerMixin, LargeFileManager):
    """
    SWAN File Manager Wrapper for content on EOS
    Adds "Project" as a new type of folder
    """

    @default("checkpoints_class")
    def _checkpoints_class_default(self):
        return EOSCheckpoints

    @default("files_handler_class")
    def _files_handler_class_default(self):
        """
        Return a SWAN personalised AuthenticatedFileHandler in order
        to access files in other users paths
        """
        return SwanAuthenticatedFileHandler

    def _is_file(self, path):
        return os.path.isfile(path)

    def _is_dir(self, path):
        return os.path.isdir(path)

    def _mkdir(self, path):
        os.mkdir(path)

    def _move(self, origin, dest, preserve):
        if preserve:
            return shutil.copytree(origin, dest)
        return shutil.move(origin, dest)

    def _files_handler_params_default(self):
        """
        Define the root path for tornado StaticFileHandler object
        This is necessary to open files from other users (for sharing tab)
        """
        if self.root_dir.startswith("/eos/"):
            return {"path": "/eos/", "default_path": self.root_dir}
        else:
            return {"path": self.root_dir}
