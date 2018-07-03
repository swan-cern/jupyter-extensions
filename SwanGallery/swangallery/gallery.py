
from notebook.base.handlers import (
    IPythonHandler, APIHandler, path_regex
)
from notebook.utils import url_path_join
from swannotebookviewer.notebookviewer import get_NotebookViewerHandler
from tornado import gen, web
from base64 import decodebytes
import logging

gallery_path = '/extra_libs/gallery'


class GalleryHandler(IPythonHandler):
    """
        When accessing the Gallery endpoint, open the Gallery html file
    """

    @web.authenticated
    def get(self, path):

        path = path.strip('/')

        self.write(self.render_template('gallery.html',
                                            page_title='Gallery',
                                            current_page=path
                                            ))


class GalleryApiHandler(APIHandler):
    """
        Provide an API to access the markdown files with the description of the galleries
        and the notebooks images.
        Used by the frontend extension.
    """

    @web.authenticated
    @gen.coroutine
    def get(self, path):

        if not path.endswith(('.md', '.png')):
            raise web.HTTPError(400,
                    u'File type not accepted', reason='bad type')

        cm = self.contents_manager
        is_image = path.endswith('.png')
        path = url_path_join(gallery_path, path)

        content, _ = cm._read_file(path, 'base64' if is_image else 'text')

        if is_image:
            self.set_header('Content-Type', 'application/octet-stream')
            b64_bytes = content.encode('ascii')
            self.write(decodebytes(b64_bytes))
            self.flush()
        else:
            self.set_header('Content-Type', 'text/plain')
            self.finish(content)


class ViewerContentsManager:
    """
        Contents manager for NotebookViewer
        This class is passed to NotebookViewer, so that it's possible
        to access the notebooks contained in the Gallery.
    """

    def __init__(self, parent):
        self.parent = parent

    def get(self, path, content=True):

        if not path.endswith('.ipynb'):
            raise web.HTTPError(400,
                    u'%s is not a notebook' % path, reason='bad type')

        cm = self.parent.contents_manager

        path = url_path_join(gallery_path, path)

        to_ret = dict()
        to_ret['type'] = 'notebook'
        to_ret['clone_url'] = path

        try:
            to_ret['content'] = cm._read_notebook(path, as_version=4)
        except FileNotFoundError:
            raise web.HTTPError(404, u'Notebook not found')

        return to_ret

def load_jupyter_server_extension(nb_server_app):
    """
    Called when the Jupyter server extension is loaded.

    Args:
        nb_server_app (NotebookWebApplication): handle to the Notebook webserver instance.
    """

    global log
    log = logging.getLogger('tornado.swangallery')
    log.name = "SwanGallery"
    log.setLevel(logging.INFO)
    log.propagate = True

    log.info("Loading Server Extension")

    # Use the NotebookViewer to provide the visualization of the example notebooks, but provide the custom cm
    new_handlers = [(r"/gallery/view%s" % path_regex, get_NotebookViewerHandler(show_clone=True, content_manager=ViewerContentsManager)),
                    (r"/gallery%s" % path_regex, GalleryHandler),
                    (r"/api/gallery%s" % path_regex, GalleryApiHandler)]

    web_app = nb_server_app.web_app
    for handler in new_handlers:
        pattern = url_path_join(web_app.settings['base_url'], handler[0])
        new_handler = tuple([pattern] + list(handler[1:]))
        web_app.add_handlers('.*$', [new_handler])
