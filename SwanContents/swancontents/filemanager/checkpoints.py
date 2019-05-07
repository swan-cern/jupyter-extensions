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


    def create_checkpoint(self, contents_mgr, path):
        """
            Copies the current file to make a version of it.
            Creates the versions folder if it doesn't exist.
        """
        try:
            checkpoint = self._new_checkpoint(path)
            os.makedirs(checkpoint['base_path'], exist_ok=True)
            self._copy(checkpoint['src_path'], checkpoint['checkpoint_path'])
            return self._get_checkpoint_return(checkpoint)
        except:
            return None

    def restore_checkpoint(self, contents_mgr, checkpoint_id, path):
        """ Replace the current file with a previous version"""
        checkpoint = self._get_checkpoint_info(path, checkpoint_id)
        self._copy(checkpoint['checkpoint_path'], checkpoint['src_path'])

    def rename_checkpoint(self, checkpoint_id, old_path, new_path):
        """ Moves all checkpoints when the notebook file is renamed """
        checkpoint_old_path = self._get_checkpoint_info(old_path, checkpoint_id)['checkpoint_path']
        checkpoint_new = self._get_checkpoint_info(new_path, checkpoint_id)
        checkpoint_new_path = checkpoint_new['checkpoint_path']

        os.makedirs(checkpoint_new['base_path'], exist_ok=True)

        if os.path.isfile(checkpoint_old_path):
            self.log.debug("Renaming checkpoint %s -> %s", checkpoint_old_path, checkpoint_new_path)

            with self.perm_to_403():
                shutil.move(checkpoint_old_path, checkpoint_new_path)

    def delete_checkpoint(self, checkpoint_id, path):
        """Remove a created version"""
        cp_path = self._get_checkpoint_info(path, checkpoint_id)['checkpoint_path']

        if not os.path.isfile(cp_path):
            self._no_such_checkpoint(path, checkpoint_id)

        self.log.debug("Unlinking checkpoint %s", cp_path)
        with self.perm_to_403():
            os.unlink(cp_path)

    def list_checkpoints(self, path):
        """
            On notebook opening, returns a list of all available versions.
            Limit the number of versions to avoid polute the interface
        """
        base = self._get_checkpoint_base(path)

        if not os.path.isdir(base['base_path']):
            return []

        try:
            files = os.listdir(base['base_path'])
            files.sort()

            # Clean old versions to prevent the list from growing indefinitely.
            # It only gets cleaned here, and not when creating a new version for example,
            # because otherwise the user would see versions that were deleted from the user interface
            # (in the restore versions menu).
            if len(files) > self.max_versions:
                n_to_delete = len(files) - self.max_versions
                for i, version in enumerate(files):
                    if i >= n_to_delete:
                        break
                    os.unlink(os.path.join(base['base_path'], version))
                files = files[n_to_delete:]

            checkpoints = []
            for file in files:
                # If the version was created outside of SWAN (i.e CERNBox), we might have
                # extra things after the timestamp, separated by a .
                name = file.split('.')[0]
                checkpoints.append(self._get_checkpoint_return(name))
            return checkpoints
        except: # If folder not accessible (the case in old FUSE) we get permission denied
            return []


    # Aux functions

    # Get the info of a new version, which corresponds to the current time
    def _new_checkpoint(self, path):
        curr_time = int(time.time())
        return self._get_checkpoint_info(path, curr_time)

    # Get the info of a version which id is given
    def _get_checkpoint_info(self, path, id):
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
            base_path = os.path.join(dirname, '.sys.v#.%s' % basename),
        )

    # Get the information structure to be returned to the caller
    def _get_checkpoint_return(self, checkpoint):
        if 'id' in checkpoint:
            id = str(checkpoint['id'])
            ts = checkpoint['id']
        else:
            # It should be string
            id = checkpoint
            ts = int(checkpoint)
        return dict(
                id = id,
                last_modified = datetime.datetime.fromtimestamp(ts).strftime('%Y-%m-%dT%H:%M:%S')
            )

    # Error Handling
    def _no_such_checkpoint(self, path, checkpoint_id):
        raise HTTPError(
            404,
            u'Checkpoint does not exist: %s@%s' % (path, checkpoint_id)
        )