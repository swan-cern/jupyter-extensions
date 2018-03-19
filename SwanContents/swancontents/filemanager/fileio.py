from notebook.services.contents.fileio import FileManagerMixin
from notebook.utils import url_path_join
from tornado.web import HTTPError
import io, os, nbformat

swan_sharing_folder = 'swan_sharing_folder/'

class SwanFileManagerMixin(FileManagerMixin):
    """
    Mixin for ContentsAPI classes that interact with the filesystem.

    Provides facilities for reading, writing, and copying both notebooks and
    generic files.
    """

    def _get_os_path(self, path):
        """ Given an API path (i.e. SWAN_projects/Proj1), return its file system path (/eos/user/u/usera/SWAN_projects/Proj1).
            The SWAN version allows access to paths outside the root folder (/eos/user/u/usera) for the shared folders specific case
        """

        if path.startswith(swan_sharing_folder):
            path = path.split('/')
            if len(path) < 3:
                 raise HTTPError(404)
            return url_path_join('/eos/user', path[1][0], path[1], 'SWAN_projects', "/".join(path[2:]))

        else:
            return super()._get_os_path(path)
