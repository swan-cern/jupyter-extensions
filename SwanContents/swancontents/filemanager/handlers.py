from notebook.base.handlers import (
    AuthenticatedFileHandler, APIHandler
)
from notebook.utils import maybe_future, url_path_join
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
        self.eosbasepath_format = os.getenv('EOS_PATH_FORMAT', '/eos/user/{username[0]}/{username}/')

    @web.authenticated
    def get(self, path):

        if self.root.startswith('/eos/'):
            if path.startswith('swan_sharing_folder/'):
                path = path.split('/')
                user_basepath = self.eosbasepath_format.format(username = path[1])
                path = url_path_join(user_basepath, 'SWAN_projects', *(path[2:]))
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

        try:
            model = yield maybe_future(self.contents_manager.download(
                url=url
            ))
            self._finish_model(model)
        except Exception as e:
            # Clean the error and show only the message
            raise web.HTTPError(400, str(e))


class ContentsHandler(APIHandler):

    @web.authenticated
    @gen.coroutine
    def delete(self, path=''):
        """delete a file in the given path"""
        cm = self.contents_manager
        self.log.warning('delete %s', path)
        yield maybe_future(cm.delete(path, force=True))
        self.set_status(204)
        self.finish()
