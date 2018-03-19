from notebook.base.handlers import AuthenticatedFileHandler
from notebook.utils import url_path_join
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

    @web.authenticated
    def get(self, path):

        if self.root.startswith('/eos/user'):
            if path.startswith('swan_sharing_folder/'):
                path = path.split('/')
                path = url_path_join('/eos/user', path[1][0], path[1], 'SWAN_projects', "/".join(path[2:]))
            else:
                path = url_path_join(self.default_path, path)

        return super(AuthenticatedFileHandler, self).get(path)
