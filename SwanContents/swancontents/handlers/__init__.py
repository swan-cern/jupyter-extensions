
from notebook.utils import url_path_join
from notebook.base.handlers import path_regex

from swancontents.handlers.projects import ProjectsHandler
from swancontents.handlers.share import ShareHandler
from swancontents.handlers.tree import TreeHandler
from swancontents.handlers.download import DownloadHandler
from swancontents.filemanager.handlers import FetchHandler

def load_jupyter_server_extension(nb_server_app):
    """ Used as a server extension in order to install the new handlers """

    new_handlers = [(r"/cernbox", TreeHandler),
                    (r"/cernbox%s" % path_regex, TreeHandler),
                    (r"/projects", ProjectsHandler),
                    (r"/projects%s" % path_regex, ProjectsHandler),
                    (r"/share", ShareHandler),
                    (r"/share%s" % path_regex, ShareHandler),
                    (r"/api/contents/fetch", FetchHandler),
                    (r"/download", DownloadHandler)]

    web_app = nb_server_app.web_app
    for handler in new_handlers:
        pattern = url_path_join(web_app.settings['base_url'], handler[0])
        new_handler = tuple([pattern] + list(handler[1:]))
        web_app.add_handlers('.*$', [new_handler])
