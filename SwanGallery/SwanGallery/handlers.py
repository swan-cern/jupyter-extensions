import json

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join

from notebook.utils import maybe_future, url_path_join
from tornado import gen, web

from urllib import parse
import re
import requests

from .proj_url_checker import check_url, is_cernbox_shared_link, get_name_from_shared_from_link, is_file_on_eos,get_eos_username, get_path_without_eos_base
from traitlets import Unicode

import os, io, shutil, subprocess, tempfile, requests
import zipfile


class RouteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server

    root_dir = ''
    swan_default_folder = '.'
    swan_default_file = '.swanproject'

    untitled_project = Unicode("Project", config=True,
        help="The base name used when creating untitled projects."
    )

    '''
    @tornado.web.authenticated
    def get(self):
        self.finish(
            


            json.dumps({
            "data": "This is /SwanGallery/get_example endpoint!"
        }))
    '''
    
    def _finish_model(self, model):
        """Finish a JSON request with a model, setting relevant headers, etc."""
        self.set_header('Content-Type', 'application/json')
        self.finish(json.dumps(model))

    @web.authenticated
    @gen.coroutine
    def get(self):

        url = "https://swan-gallery.web.cern.ch/notebooks/root_primer/OldSummerStudentsCourse/2017/examples/notebooks/Macro1_cpp.ipynb"
        #url = "https://github.com/dpiparo/swanExamples.git"
        #url = self.get_query_argument('url', default=None)

        if not url:
            raise web.HTTPError(400, u'No url provided')
        check_url(url)

        try:
            model = yield maybe_future(self.download(
                url=url
            ))
            self._finish_model(model)
        except Exception as e:
            # Clean the error and show only the message
            raise web.HTTPError(400, e)


    def download(self, url):
        """ Downloads a Project from git or cernbox """

        model = {}
        tmp_dir_name = tempfile.mkdtemp()

        if url.endswith('.git'):

            rc = subprocess.call(['git', 'clone', url, tmp_dir_name])
            if rc != 0:
                raise web.HTTPError(400, "It was not possible to clone the repo %s. Did you pass the username/token?" % url)

            # Also download submodules if they exist
            subprocess.call(['git', 'submodule', 'update', '--init', '--recursive'], cwd=tmp_dir_name)

            dest_dir_name_ext = os.path.basename(url)
            repo_name_no_ext = os.path.splitext(dest_dir_name_ext)[0]
            dest_dir_name = os.path.join(repo_name_no_ext)

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
                shutil.copy2(file_path, tmp_dir_name)
                file_name = file_path.split('/').pop()
                file_name_no_ext = os.path.splitext(file_name)[0]
                dest_dir_name = os.path.join(file_name_no_ext)

                model['type'] = 'file'
                model['path'] = self.move_file(file_name, tmp_dir_name, dest_dir_name)
                #model['path'] = os.path.join(self.move_folder(tmp_dir_name, dest_dir_name), file_name)

        elif url.startswith('local:'):
            path = url[6:]
            file_name = path.split('/').pop()

            if os.path.isdir(path):

                dest_dir_name = os.path.join(file_name)

                model['type'] = 'directory'
                model['path'] = self.move_folder(path, dest_dir_name, preserve=True)

            elif os.path.isfile(path):

                shutil.copy2(path, tmp_dir_name)
                file_name_no_ext = os.path.splitext(file_name)[0]
                dest_dir_name = os.path.join(file_name_no_ext)

                model['type'] = 'file'
                model['path'] = self.move_file(file_name, tmp_dir_name, dest_dir_name)
                #model['path'] = os.path.join(self.move_folder(tmp_dir_name, dest_dir_name), file_name)

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
            dest_dir_name = os.path.join(file_name_no_ext)

            model['type'] = 'file'
            model['path'] = self.move_file(file_name, tmp_dir_name, dest_dir_name)
            #model['path'] = os.path.join(self.move_folder(tmp_dir_name, dest_dir_name), file_name)

        model['path'] = model['path'].replace(self.root_dir, '').strip('/')
        
        return model
        

    #def move_folder(self,file_name, origin, dest, preserve=False):
    def move_folder(self, origin, dest, preserve=False):
            """ Move a folder to a new location, but renames it if it already exists """

            # If the name exists, get a new one
            if os.path.isdir(dest):
                count = 1
                while os.path.isdir(dest + str(count)):
                    count += 1
                dest += str(count)

            if preserve:
                path = shutil.copytree(origin, dest)
            else:
                path = shutil.move(origin, dest)

            return path

    def move_file(self, file_name, origin, dest, preserve=False):
            """ Move a folder to a new location, but renames it if it already exists """

            file_format = file_name.split(".")[1]
            new_file_name = file_name
            # If the name exists, get a new one
            if os.path.isfile(dest+"/"+new_file_name):
                new_file_name = file_name.split(".")[0]
                count = 1
                while os.path.isfile(new_file_name + str(count) + "." + file_format):
                    count += 1
            
            new_file_name += str(count) + "." + file_format

            if preserve:
                path = shutil.copytree(origin+"/"+file_name, self.swan_default_folder+"/"+new_file_name)
            else:
                path = shutil.move(origin+"/"+file_name, self.swan_default_folder+"/"+new_file_name)

            return path

def setup_handlers(web_app):
    host_pattern = ".*$"

    base_url = web_app.settings["base_url"]
    route_pattern = url_path_join(base_url, "SwanGallery", "notebook")
    handlers = [(route_pattern, RouteHandler)]
    web_app.add_handlers(host_pattern, handlers)