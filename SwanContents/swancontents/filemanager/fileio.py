from notebook.services.contents.fileio import FileManagerMixin
from notebook.utils import url_path_join
from tornado.web import HTTPError
from contextlib import contextmanager
import io, os, nbformat
import subprocess

swan_sharing_folder = 'swan_sharing_folder/'


@contextmanager
def atomic_writing(path, text=True, encoding='utf-8', log=None, **kwargs):
    """Context manager to write to a file only if the entire write is successful.

    This works by writing the contents to a temp file and rename it to the target.
    If writing fails, we remove the temp file and leave the target unchanged.

    Parameters
    ----------
    path : str
      The target file to write to.

    text : bool, optional
      Whether to open the file in text mode (i.e. to write unicode). Default is
      True.

    encoding : str, optional
      The encoding to use for files opened in text mode. Default is UTF-8.

    **kwargs
      Passed to :func:`io.open`.
    """
    # realpath doesn't work on Windows: http://bugs.python.org/issue9949
    # Luckily, we only need to resolve the file itself being a symlink, not
    # any of its directories, so this will suffice:
    if os.path.islink(path):
        path = os.path.join(os.path.dirname(path), os.readlink(path))

    dirname, basename = os.path.split(path)
    # The .~ prefix will make Dropbox ignore the temporary file.
    tmp_path = os.path.join(dirname, '.~'+basename)

    if text:
        # Make sure that text files have Unix linefeeds by default
        kwargs.setdefault('newline', '\n')
        fileobj = io.open(tmp_path, 'w', encoding=encoding, **kwargs)
    else:
        fileobj = io.open(tmp_path, 'wb', **kwargs)

    try:
        yield fileobj

        # Flush to disk
        fileobj.flush()
        os.fsync(fileobj.fileno())
        fileobj.close()

        # To create a version of the file, enable that eos functionality on the parent directory
        if path.startswith('/eos/'):
            subprocess.run(["setfattr","-n", "user.fusex.rename.version", "-v", "1", dirname])

        # Try to rename tmp file to the original name
        # This is an atomic operation and will silently replace the current file
        # This operation will also create a version automatically, since we set the option before
        os.replace(tmp_path, path)

    except:
        # Close the file in case it failed writing
        fileobj.close()
        # Remove the tmp file
        if os.path.isfile(tmp_path):
            os.remove(tmp_path)

        # Even if renaming failed, there's nothing else to do because the temp was already deleted....
        raise

    finally:
        # Remove the versioning option to revert to default behaviour
        # This will complain if the exception occurred before setting this attr,
        # but it will not generate a new exception.
        if path.startswith('/eos/'):
            subprocess.run(["setfattr","-x", "user.fusex.rename.version", dirname])


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
                
            eosbasepath_format = os.getenv('EOS_PATH_FORMAT', '/eos/user/{username[0]}/{username}/')
            user_basepath = eosbasepath_format.format(username = path[1])
            return url_path_join(user_basepath, 'SWAN_projects', *(path[2:]))

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

    @contextmanager
    def atomic_writing(self, os_path, *args, **kwargs):
        """Overload the default atomic_writing to use a different write method
        From the original documentation:
        wrapper around atomic_writing that turns permission errors to 403.
        Depending on flag 'use_atomic_writing', the wrapper perform an actual atomic writing or
        simply writes the file (whatever an old exists or not)"""


        if self.use_atomic_writing:
            with self.perm_to_403(os_path):
                with atomic_writing(os_path, *args, log=self.log, **kwargs) as f:
                    yield f
        else:
            # Return to the default behaviour
            super().atomic_writing(os_path, *args, **kwargs)
