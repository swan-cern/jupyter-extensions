from notebook.base.handlers import (
    AuthenticatedFileHandler, APIHandler
)
from notebook.utils import url_path_join
from notebook.base.handlers import json_errors
from tornado import gen, web
from .proj_url_checker import check_url
import os, json

class SwanAuthenticatedFileHandler(AuthenticatedFileHandler):
    """
        Wrap AuthenticatedFileHandler to convert the virtual swan_sharing_folder
        into a valid EOS path.
        Used to access other users paths.
    """

    def initialize(self, path, default_path=None, default_filename=None):
        self.root = os.path.abspath(path) + os.path.sep
        self.default_filename = default_filename
        self.default_path = default_path

    @web.authenticated
    def get(self, path):

        if self.root.startswith('/eos/user'):
            if path.startswith('swan_sharing_folder/'):
                path = path.split('/')
                path = url_path_join('/eos/user', path[1][0], path[1], 'SWAN_projects', "/".join(path[2:]))
            else:
                path = url_path_join(self.default_path, path)

        return super(AuthenticatedFileHandler, self).get(path)


class FetchHandler(APIHandler):
    """
         Handler for the API calls used by the fetcher.
         Asks the file manager to download the project provided and retrieves the path where it was stored.
    """

    def _finish_model(self, model):
        """Finish a JSON request with a model, setting relevant headers, etc."""
        self.set_header('Content-Type', 'application/json')
        self.finish(json.dumps(model))

    @web.authenticated
    @gen.coroutine
    def get(self):

        url = self.get_query_argument('url', default=None)
        if not url:
            raise web.HTTPError(400, u'No url provided')
        check_url(url)

        model = yield gen.maybe_future(self.contents_manager.download(
            url=url
        ))
        self._finish_model(model)


class ContentsHandler(APIHandler):

    @json_errors
    @web.authenticated
    @gen.coroutine
    def delete(self, path=''):
        """delete a file in the given path"""
        cm = self.contents_manager
        self.log.warning('delete %s', path)
        yield gen.maybe_future(cm.delete(path, force=True))
        self.set_status(204)
        self.finish()
