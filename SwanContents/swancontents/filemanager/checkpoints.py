from notebook.services.contents.checkpoints import Checkpoints
from .fileio import SwanFileManagerMixin
import os, time, datetime, shutil
from traitlets import Unicode, Int
from tornado.web import HTTPError



class EOSCheckpoints(SwanFileManagerMixin, Checkpoints):
    """
        Implements Checkpoints interface for EOS.
        This allows the creation of EOS versions, visible both from
        SWAN and CERNBox.
    """

    max_versions = Int(
        default_value=25,
        config=True,
        help="Number of version files to keep",
    )

    root_dir = Unicode(config=True)

    version_base = Unicode(
        default_value='.sys.v#.%s',
        config=True
    )

    latest_recorded = {}


    def create_checkpoint(self, contents_mgr, path):
        """
            EOS creates automatically a version by using the atomic writing.
            So we just need to return the latest checkpoint created
        """
        self.log.info(f"Creating checkpoint for {path}")
        # To check if the version returned is new or already known (an error might have occurred)
        previous_recorded = self.latest_recorded[path] if path in self.latest_recorded else None
        checkpoints = self.list_checkpoints(path)

        if not checkpoints:
            self.log.warning("No checkpoint was created")
            # Jupyterlab crashes opening a file if no checkpoint exists
            # While this is not fixed upstream, we return a fake one
            return self._get_mock_checkpoint(path)

        current_checkpoint = checkpoints[-1]
        
        if previous_recorded and previous_recorded['id'] == current_checkpoint['id']:
            #If we're returning the same checkpoint again, something happened...
            self.log.error("Same checkpoint found. Something happened...")
            return None

        return current_checkpoint

    def restore_checkpoint(self, contents_mgr, checkpoint_id, path):
        """ Replace the current file with a previous version"""
        checkpoint = self._get_checkpoint_info(path, checkpoint_id)
        try:
            self._copy(checkpoint['checkpoint_path'], checkpoint['src_path'])
        except: 
            # the version might no longer exist if it was cleaned (by default EOS should keep 10 versions)
            self._no_such_checkpoint(path, checkpoint_id)



    def rename_checkpoint(self, checkpoint_id, old_path, new_path):
        """
            Called when notebook file is renamed.
            EOS should handle this by itself.
        """
        pass

    def delete_checkpoint(self, checkpoint_id, path):
        """Remove a created version"""
        cp_path = self._get_checkpoint_info(path, checkpoint_id)['checkpoint_path']

        if not os.path.isfile(cp_path):
            self._no_such_checkpoint(path, checkpoint_id)

        self.log.debug("Unlinking checkpoint %s", cp_path)
        with self.perm_to_403():
            os.unlink(cp_path)

    def list_checkpoints(self, path):
        """ On notebook opening, returns a list of all available versions. """
        base = self._get_checkpoint_base(path)

        try:
            files = os.listdir(base['base_path'])
            files.sort()
            to_return = [self._get_checkpoint_return(file) for file in files]
            # Keep track of the latest version to compare when creating a new one
            self.latest_recorded[path] = to_return[-1]
            return to_return
        except: # If folder doesn't exist or we get permission denied/not accessible (the case in old FUSE)
            return []


    # Aux functions

    # Get the info of a version which id is given
    def _get_checkpoint_info(self, path, id):
        id = id.replace('_', '.') # Jupyter does not support . in the url
        base = self._get_checkpoint_base(path)
        base.update(dict(
            id=id,
            checkpoint_path=os.path.join(base['base_path'], str(id))
        ))
        return base

    # Get the path where the version should be stored.
    # EOS has a special hidden folder convetion for these files.
    def _get_checkpoint_base(self, path):
        src_path = self._get_os_path(path=path)
        dirname, basename = os.path.split(src_path)
        return dict(
            src_path=src_path,
            base_path = os.path.join(dirname, self.version_base % basename),
        )

    # Get the information structure to be returned to the caller
    def _get_checkpoint_return(self, checkpoint):
        id = checkpoint.replace('.', '_') # Jupyter does not support . in the url
        ts = int(checkpoint.split('.')[0])
        ts = datetime.datetime.fromtimestamp(ts)
        return dict(
                id = id,
                last_modified = ts.strftime('%Y-%m-%dT%H:%M:%S')
            )

    # Error Handling
    def _no_such_checkpoint(self, path, checkpoint_id):
        raise HTTPError(
            404,
            u'Checkpoint no longer exists: %s@%s' % (path, checkpoint_id)
        )

    def _get_mock_checkpoint(self, path):
        src_path = self._get_os_path(path=path)
        mtime = os.path.getmtime(src_path)
        ts = datetime.datetime.fromtimestamp(mtime)
        return dict(
                id = "0_0",
                last_modified = ts.strftime('%Y-%m-%dT%H:%M:%S')
            )