from notebook.services.contents.largefilemanager import LargeFileManager
from tornado import web
import nbformat
from nbformat.v4 import new_notebook
from traitlets import Unicode
import os, io
import stat
import shutil
from notebook.utils import (
    is_hidden, is_file_hidden
)


class SwanFileManager(LargeFileManager):
    """ SWAN File Manager Wrapper
        Adds "Project" as a new type of folder
    """

    swan_default_folder = 'SWAN_projects'
    swan_default_file = '.swanproject'

    untitled_project = Unicode("Project", config=True,
        help="The base name used when creating untitled projects."
    )

    def _get_project_path(self, path):
        """ Return the project path where the path provided belongs to """

        folders = path.replace(self.root_dir+'/', '', 1).split('/')
        if len(folders) == 0 or folders[0] != self.swan_default_folder:
            return 'invalid'

        path_to_project = folders[0]
        for folder in folders[1:]:
            path_to_project += '/' + folder
            if os.path.isfile(self._get_os_path(path_to_project + '/' + self.swan_default_file)):
                return path_to_project

        return None

    def _is_swan_root_folder(self, path):
        """ Check is this is SWAN projects folder """

        folders = path.replace(self.root_dir+'/', '', 1).split('/')
        if len(folders) == 2 and folders[0] == self.swan_default_folder:
            return True

        return False

    def _contains_swan_folder_name(self, path):
        """ To prevent users from using the default SWAN projects folder name """

        folders = path.replace(self.root_dir+'/'+self.swan_default_folder+'/', '', 1).split('/')
        for folder in folders:
            if folder == self.swan_default_folder:
                return True

        return False

    def _dir_model(self, path, content=True):
        """ When returning the info of a folder, add the info of the project to which it belong to (if inside a Project) """

        model = super(LargeFileManager, self)._dir_model(path, content)
        parent_project = self._get_project_path(path)

        if parent_project and not parent_project == 'invalid':
            model['project'] = parent_project

        return model

    def _proj_model(self, path, content=True):
        """ Build a model for a directory
            if content is requested, will include a listing of the directory
        """
        os_path = self._get_os_path(path)
        four_o_four = u'directory does not exist: %r' % path

        if not os.path.isdir(os_path):
            raise web.HTTPError(404, four_o_four)

        elif is_hidden(os_path, self.root_dir):
            self.log.info("Refusing to serve hidden directory %r, via 404 Error",
                os_path
            )

            raise web.HTTPError(404, four_o_four)

        model = self._base_model(path)
        model['type'] = 'project'
        if content:
            model['content'] = contents = []
            os_dir = self._get_os_path(path)
            for name in os.listdir(os_dir):
                try:
                    os_path = os.path.join(os_dir, name)

                except UnicodeDecodeError as e:
                    self.log.warning(
                        "failed to decode filename '%s': %s", name, e)

                    continue

                try:
                    st = os.stat(os_path)

                except OSError as e:
                    # skip over broken symlinks in listing
                    if e.errno == errno.ENOENT:
                        self.log.warning("%s doesn't exist", os_path)

                    else:
                        self.log.warning("Error stat-ing %s: %s", os_path, e)

                    continue

                if not stat.S_ISREG(st.st_mode) and not stat.S_ISDIR(st.st_mode):
                    self.log.debug("%s not a regular file", os_path)

                    continue

                if self.should_list(name) and not is_file_hidden(os_path, stat_res=st):
                    contents.append(self.get(
                        path='%s/%s' % (path, name),
                        content=False)
                    )

            model['format'] = 'json'

        return model

    def _save_project(self, os_path, model, path=''):
        """ create a project """

        if is_hidden(os_path, self.root_dir):
            raise web.HTTPError(400, u'Cannot create hidden directory %r' % os_path)
        if not os.path.exists(os_path):
            with self.perm_to_403():
                os.mkdir(os_path)
                self._save_file(os_path + '/' + self.swan_default_file, '', 'text')
        elif not os.path.isdir(os_path):
            raise web.HTTPError(400, u'Not a directory: %s' % (os_path))
        else:
            self.log.debug("Directory %r already exists", os_path)

    def get(self, path, content=True, type=None, format=None):
        """ Get info from a path"""

        path = path.strip('/')

        if path != self.swan_default_folder and not self.exists(path):
            raise web.HTTPError(404, u'No such file or directory: %s' % path)

        os_path = self._get_os_path(path)

        if path == self.swan_default_folder and not os.path.isdir(os_path):
            os.mkdir(os_path)

        os_path_proj = self._get_os_path(path + '/' + self.swan_default_file)

        if os.path.isdir(os_path) and os.path.isfile(os_path_proj):
            if type not in (None, 'project', 'directory'):
                raise web.HTTPError(400,
                                u'%s is a project, not a %s' % (path, type), reason='bad type')

            model = self._proj_model(path, content=content)

        else:
            model = super(LargeFileManager, self).get(path, content)
        return model

    def save(self, model, path=''):
        """ Save the file model and return the model with no content """

        if 'type' not in model:
            raise web.HTTPError(400, u'No file type provided')
        if 'content' not in model and model['type'] != 'directory' and model['type'] != 'project':
            raise web.HTTPError(400, u'No file content provided')

        path = path.strip('/')
        os_path = self._get_os_path(path)

        if self._contains_swan_folder_name(os_path):
            raise web.HTTPError(400, "The name %s is restricted" % self.swan_default_folder)

        self.log.debug("Saving %s", os_path)
        self.run_pre_save_hook(model=model, path=path)

        try:
            if model['type'] == 'project':
                if not self._is_swan_root_folder(os_path):
                    raise web.HTTPError(400, "You can only create projects inside Swan Projects")
                self._save_project(os_path, model, path)

            else:
                if model['type'] == 'notebook':
                    nb = nbformat.from_dict(model['content'])
                    self.check_and_sign(nb, path)
                    self._save_notebook(os_path, nb)
                    # One checkpoint should always exist for notebooks.
                    if not self.checkpoints.list_checkpoints(path):
                        self.create_checkpoint(path)

                elif model['type'] == 'file':
                    # Missing format will be handled internally by _save_file.
                    self._save_file(os_path, model['content'], model.get('format'))

                elif model['type'] == 'directory':
                    self._save_directory(os_path, model, path)

                else:
                    raise web.HTTPError(400, "Unhandled contents type: %s" % model['type'])

        except web.HTTPError:
            raise

        except Exception as e:
            self.log.error(u'Error while saving file: %s %s', path, e, exc_info=True)
            raise web.HTTPError(500, u'Unexpected error while saving file: %s %s' % (path, e))

        validation_message = None
        if model['type'] == 'notebook':
            self.validate_notebook_model(model)
            validation_message = model.get('message', None)

        model = self.get(path, content=False)
        if validation_message:
            model['message'] = validation_message

        self.run_post_save_hook(model=model, os_path=os_path)

        return model

    def new(self, model=None, path=''):
        """ Create a new file or directory and return its model with no content
            To create a new untitled entity in a directory, use `new_untitled`
        """
        path = path.strip('/')
        if model is None:
            model = {}

        if path.endswith('.ipynb'):
            model.setdefault('type', 'notebook')
        else:
            model.setdefault('type', 'file')

        # no content, not a directory, so fill out new-file model
        if 'content' not in model \
                and model['type'] != 'directory' \
                and model['type'] != 'project':
            if model['type'] == 'notebook':
                model['content'] = new_notebook()
                model['format'] = 'json'
            else:
                model['content'] = ''
                model['type'] = 'file'
                model['format'] = 'text'

        model = self.save(model, path)
        return model

    def new_untitled(self, path='', type='', ext=''):
        """ Create a new untitled file or directory in path
            path must be a directory
            File extension can be specified.
            Use `new` to create files with a fully specified path (including filename).
        """

        path = path.strip('/')
        if not self.dir_exists(path):
            raise HTTPError(404, 'No such directory: %s' % path)

        model = {}
        if type:
            model['type'] = type

        if ext == '.ipynb':
            model.setdefault('type', 'notebook')
        else:
            model.setdefault('type', 'file')

        insert = ''
        if model['type'] == 'directory':
            untitled = self.untitled_directory
            insert = ' '

        elif model['type'] == 'project':
            untitled = self.untitled_project
            insert = ' '

        elif model['type'] == 'notebook':
            untitled = self.untitled_notebook
            ext = '.ipynb'

        elif model['type'] == 'file':
            untitled = self.untitled_file

        else:
            raise HTTPError(400, "Unexpected model type: %r" % model['type'])

        name = self.increment_filename(untitled + ext, path, insert=insert)
        path = u'{0}/{1}'.format(path, name)

        return self.new(model, path)

    def update(self, model, path):
        """ Prevent users from using the name of SWAN projects folder"""

        if self._contains_swan_folder_name(self._get_os_path(path)):
            raise web.HTTPError(400, "The name %s is restricted" % self.swan_default_folder)

        return super(LargeFileManager, self).update(model, path)

    def delete_file(self, path):
        """Delete file at path."""

        path = path.strip('/')
        os_path = self._get_os_path(path)
        rm = os.unlink
        if os.path.isdir(os_path):
            listing = os.listdir(os_path)
            # Don't delete non-empty directories.
            # A directory containing only leftover checkpoints is
            # considered empty.
            cp_dir = getattr(self.checkpoints, 'checkpoint_dir', None)
            for entry in listing:
                if entry != cp_dir and entry != self.swan_default_file:
                    raise web.HTTPError(400, u'Directory %s not empty' % os_path)

        elif not os.path.isfile(os_path):
            raise web.HTTPError(404, u'File does not exist: %s' % os_path)

        if os.path.isdir(os_path):
            self.log.debug("Removing directory %s", os_path)
            with self.perm_to_403():
                shutil.rmtree(os_path)

        else:
            self.log.debug("Unlinking file %s", os_path)
            with self.perm_to_403():
                rm(os_path)
