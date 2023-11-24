from jupyter_server.base.handlers import AuthenticatedFileHandler
from jupyter_server.utils import url_path_join
from tornado import web
import os


class SwanAuthenticatedFileHandler(AuthenticatedFileHandler):
    """
    Wrap AuthenticatedFileHandler to convert the virtual swan_sharing_folder
    into a valid EOS path.
    Used to access other users paths.
    """

    def initialize(self, path, default_path=None, default_filename=None):
        self.root = os.path.abspath(path) + os.path.sep
        self.default_filename = default_filename
        self.default_path = default_path
        self.eosbasepath_format = os.getenv(
            "EOS_PATH_FORMAT", "/eos/user/{username[0]}/{username}/"
        )

    @web.authenticated
    def get(self, path):
        if self.root.startswith("/eos/"):
            if path.startswith("swan_sharing_folder/"):
                path = path.split("/")
                user_basepath = self.eosbasepath_format.format(username=path[1])
                path = url_path_join(user_basepath, "SWAN_projects", *(path[2:]))
            else:
                path = url_path_join(self.default_path, path)

        return super(AuthenticatedFileHandler, self).get(path)
