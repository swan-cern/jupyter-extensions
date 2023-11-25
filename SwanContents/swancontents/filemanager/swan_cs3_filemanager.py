from .projects_mixin import ProjectsMixin
from cs3api4lab import CS3APIsManager

class SwanCs3FileManager(ProjectsMixin, CS3APIsManager):
    
    def _get_os_path(self, path):
        """Given an API path, return its file system path.

        Parameters
        ----------
        path : string
            The relative API path to the named file.

        Returns
        -------
        path : string
            Native, absolute OS path to for a file.

        Raises
        ------
        404: if path is outside root
        """
        # root = os.path.abspath(self.root_dir)
        # os_path = to_os_path(path, root)
        # if not (os.path.abspath(os_path) + os.path.sep).startswith(root):
        #     raise HTTPError(404, "%s is outside root contents directory" % path)
        # return os_path
        pass

    def _is_file(self, path):
        pass

    def _is_dir(self, path):
        pass
    
    def _mkdir(self, path):
        pass

    def _move(self, origin, dest, preserve):
        # preserve ? copies :  moves
        pass