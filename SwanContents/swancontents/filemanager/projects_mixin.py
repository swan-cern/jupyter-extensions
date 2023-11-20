
from traitlets import HasTraits, Unicode
from tornado import web
import os, io, shutil, subprocess, tempfile, requests
from .proj_url_checker import (
    is_cernbox_shared_link,
    get_name_from_shared_from_link,
    is_file_on_eos,
    get_eos_username,
    get_path_without_eos_base
)


class InvalidProject(Exception):
    pass

class ProjectsMixin(HasTraits):

    swan_default_folder = Unicode("SWAN_projects", config=True,
        help=""
    )

    swan_default_file = Unicode(".swanproject", config=True,
        help=""
    )

    untitled_project = Unicode("Project", config=True,
        help="The base name used when creating untitled projects."
    )

    def _get_project_path(self, path):
        """ Return the project path where the path provided belongs to """

        folders = path.replace(self.root_dir+'/', '', 1).split('/')
        if len(folders) == 0 or folders[0] != self.swan_default_folder:
            raise InvalidProject

        path_to_project = folders[0]
        for folder in folders[1:]:
            path_to_project += '/' + folder
            if self._is_file(self._get_os_path(os.path.join(path_to_project, self.swan_default_file))):
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

        folders = path.replace(self.root_dir + '/' + self.swan_default_folder + '/', '', 1).split('/')
        for folder in folders:
            if folder == self.swan_default_folder:
                return True

        return False

    def _dir_model(self, path, content=True):
        """ When returning the info of a folder, add the info of the project to which it belong to (if inside a Project) """

        model = super()._dir_model(path, content)
        model['is_project'] = False

        try:
            parent_project = self._get_project_path(path)
            if parent_project:
                model['project'] = parent_project
        except InvalidProject:
            pass

        return model

    def _proj_model(self, path, content=True):
        """ Build a model for a directory
            if content is requested, will include a listing of the directory
            Now we can re-use the folder model because it's just a folder with 
            an extra bool inside
        """

        model = super()._dir_model(path, content)
        model['is_project'] = True
        return model

    def _save_project(self, os_path, model, path=''):
        """ Creates a project
            A project is just a folder with a hidden file inside it  
        """

        # To avoid having to copy code from upstream, just call parent
        # and write a file if the path did not exist before.
        # The drawback is that we need to check if it exists twice...
        # FIXME maybe not efficient with CS3 calls?
        create_file = not self.exists(os_path)

        super()._save_directory(os_path, model, path)

        # FIXME if a folder already existed with this name, 
        # should we also tranform it into a project?
        if create_file:
            with self.perm_to_403():
                self._save_file(os.path.join(os_path, self.swan_default_file), '', 'text')

    def get(self, path, content=True, type=None, format=None):
        """ Get info from a path"""

        path = path.strip('/')

        if path != self.swan_default_folder and not self.exists(path):
            raise web.HTTPError(404, u'No such file or directory: %s' % path)

        os_path = self._get_os_path(path)

        if path == self.swan_default_folder and not self._is_dir(os_path):
            self._mkdir(os_path)

        os_path_proj = self._get_os_path(os.path.join(path, self.swan_default_file))

        if self._is_dir(os_path) and self._is_file(os_path_proj):
            if type not in (None, 'project', 'directory'):
                raise web.HTTPError(400,
                                u'%s is a project, not a %s' % (path, type), reason='bad type')

            model = self._proj_model(path, content=content)

        else:
            model = super().get(path, content, type, format)
        return model

    def save(self, model, path=''):
        """ Save the file model and return the model with no content """

        chunk = model.get('chunk', None)
        if chunk is not None:
            return super().save(model, path)

        if 'type' not in model:
            raise web.HTTPError(400, u'No file type provided')
        
        if model['type'] != 'directory' or 'is_project' not in model or not model['is_project']:
            return super().save(model, path)

        path = path.strip('/')
        os_path = self._get_os_path(path)

        if self._contains_swan_folder_name(os_path):
            raise web.HTTPError(400, "The name %s is restricted" % self.swan_default_folder)

        self.log.debug("Creating project %s", os_path)

        try:
            if not self._is_swan_root_folder(os_path):
                raise web.HTTPError(400, "You can only create projects inside SWAN Projects")
            self._save_project(os_path, model, path)

        except web.HTTPError:
            raise

        except Exception as e:
            self.log.error(u'Error while creating a Project: %s %s', path, e, exc_info=True)
            raise web.HTTPError(500, f"Unexpected error while creating a Project: {path} {e}") from e
        
        return self.get(path, content=False)
        

    def new_untitled(self, path='', type='', ext=''):
        """ Create a new untitled file or directory in path
            path must be a directory
            File extension can be specified.
            Use `new` to create files with a fully specified path (including filename).
        """
        
        if type != 'directory' or ext != 'project':
            return super().new_untitled(path, type=type, ext=ext)

        path = path.strip('/')
        if not self.dir_exists(path):
            raise web.HTTPError(404, 'No such directory: %s' % path)

        model = {
            'type': 'directory',
            'is_project': True
        }
        name = self.increment_filename(self.untitled_project, path, insert=' ')
        path = f'{path}/{name}'

        return self.new(model, path)
        

    def update(self, model, path):
        """ Prevent users from using the name of SWAN projects folder"""

        if self._contains_swan_folder_name(self._get_os_path(path)):
            raise web.HTTPError(400, "The name %s is restricted" % self.swan_default_folder)

        return super().update(model, path)


    def move_folder(self, origin, dest, preserve=False):
        """ Move a folder to a new location, but renames it if it already exists """

        # If the name exists, get a new one
        if self._is_dir(dest):
            count = 1
            while self._is_dir(dest + str(count)):
                count += 1
            dest += str(count)

        self._move(origin, dest, preserve)

        # Make the folder a SWAN Project
        self._save_file(os.path.join(dest, self.swan_default_file), '', 'text')

        return dest

    def download(self, url):
        """ Downloads a Project from git or cernbox """

        model = {}
        tmp_dir_name = tempfile.mkdtemp()

        if url.endswith('.git'):
            # Use subprocess.run instead of subprocess.call as the later one is deprecated and add the "--"
            # to separate the process arguments from the url, to prevent users from passing command options
            # in the place of the url.
            rc = subprocess.run(['git', 'clone', '--recurse-submodules', '--depth=1', '--', url, tmp_dir_name])
            if rc.returncode != 0:
                raise web.HTTPError(400, "It was not possible to clone the repo %s. Did you pass the username/token?" % url)

            dest_dir_name_ext = os.path.basename(url)
            repo_name_no_ext = os.path.splitext(dest_dir_name_ext)[0]
            dest_dir_name = os.path.join(self.root_dir, self.swan_default_folder, repo_name_no_ext)

            model['type'] = 'directory'
            model['path'] = self.move_folder(tmp_dir_name, dest_dir_name)

        elif is_file_on_eos(url):
            # Opened from "Open in SWAN" button
            file_path = url[6:]
            username = get_eos_username(file_path)
            if username == get_eos_username(self.root_dir):
                # Inside user own directory
                model['type'] = 'file'
                model['path'] = get_path_without_eos_base(file_path)

            else:
                # Outside of user directory. Copy the file.
                shutil.copy2(file_path, tmp_dir_name) ##### FIXME
                file_name = file_path.split('/').pop()
                file_name_no_ext = os.path.splitext(file_name)[0]
                dest_dir_name = os.path.join(self.root_dir, self.swan_default_folder, file_name_no_ext)

                model['type'] = 'file'
                model['path'] = os.path.join(self.move_folder(tmp_dir_name, dest_dir_name), file_name)

        elif url.startswith('local:'):
            path = url[6:]
            file_name = path.split('/').pop()

            if os.path.isdir(path):

                dest_dir_name = os.path.join(self.root_dir, self.swan_default_folder, file_name)

                model['type'] = 'directory'
                model['path'] = self.move_folder(path, dest_dir_name, preserve=True)

            elif os.path.isfile(path):

                shutil.copy2(path, tmp_dir_name) ##### FIXME
                file_name_no_ext = os.path.splitext(file_name)[0]
                dest_dir_name = os.path.join(self.root_dir, self.swan_default_folder, file_name_no_ext)

                model['type'] = 'file'
                model['path'] = os.path.join(self.move_folder(tmp_dir_name, dest_dir_name), file_name)

            else:
                raise web.HTTPError(404, u'File or directory does not exist: %s' % path)


        else:
            is_on_cernbox = is_cernbox_shared_link(url)

            # Get the file name
            file_name = os.path.basename(url)

            # Download the file and store it with the correct name inside the temp folder
            # or unzip all files if it's compressed
            r = requests.get(url, stream=True)
            if is_on_cernbox:
                file_name = get_name_from_shared_from_link(r)

            if file_name.endswith('.zip'):
                with zipfile.ZipFile(io.BytesIO(r.content)) as nb_zip:
                    nb_zip.extractall(tmp_dir_name)
                    # Change to the notebook file to allow the redirection to open it
                    file_name = file_name.replace('.zip', '.ipynb')

            else:
                nb_path = os.path.join(tmp_dir_name, file_name)
                with open(nb_path, "w+b") as nb:
                    nb.write(r.content)

            # Get the destination folder path
            file_name_no_ext = os.path.splitext(file_name)[0]
            dest_dir_name = os.path.join(self.root_dir, self.swan_default_folder, file_name_no_ext)

            model['type'] = 'file'
            model['path'] = os.path.join(self.move_folder(tmp_dir_name, dest_dir_name), file_name)

        model['path'] = model['path'].replace(self.root_dir, '').strip('/')

        return model
