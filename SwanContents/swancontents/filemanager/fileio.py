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

    def _read_notebook(self, os_path, as_version=4):
        """Read a notebook from an os path."""
        with self.open(os_path, 'r', encoding='utf-8') as f:
            try:
                return nbformat.read(f, as_version=as_version)
            except Exception as e:
                raise HTTPError(
                    400,
                    u"Unreadable Notebook: %s %r" % (os_path, e),
                )

    def _save_notebook(self, os_path, nb):
        """
        Save a notebook on EOS via FUSE with the default routine.
        Plus, store a copy of the same notebook on the host machine via docker volume.
        """
        import time
        def write_notebook_to_local(path, content, encoding='utf-8'):
            try:
                fout = io.open(path, 'w', encoding=encoding)
                nbformat.write(content, fout, version=nbformat.NO_CONVERT)
                fout.flush()
                os.fsync(fout.fileno())
                fout.close()
            except:
                pass
            return

        def read_notebook_from_local(path, encoding='utf-8', as_version=4):
            try:
                with io.open(path, 'r', encoding=encoding) as fin:
                    return nbformat.read(fin, as_version=as_version)
            except:
                return nbformat.v4.new_notebook()

        # If the path on the host is defined, save a copy of the notebook there
        if ('USERDATA_PATH' in os.environ and os.path.isdir(os.environ['USERDATA_PATH'])):
            # Define the filename for the local copy
            dirname, basename = os.path.split(os_path)
            local_fname = "-".join([os.environ['USER'], "nb", str(int(time.time())), dirname.replace(os.sep, "-"), basename])
            local_path = os.path.join(os.environ['USERDATA_PATH'], local_fname)

            # Write the notebook locally and check for consistency
            local_retry = 10
            local_checksum = False
            write_notebook_to_local(local_path, nb)
            for i in range(0, local_retry):
                read_nb = read_notebook_from_local(local_path)
                if (nb == read_nb):
                    local_checksum = True
                    break
                else:
                    #time.sleep(0.1*2**i)    # Backoff on retry (100ms to 51.2s)
                    time.sleep(0.5)
                    write_notebook_to_local(local_path, nb)

        # In all cases, save on eos via fuse
        with self.atomic_writing(os_path, encoding='utf-8') as f:
            nbformat.write(nb, f, version=nbformat.NO_CONVERT)
