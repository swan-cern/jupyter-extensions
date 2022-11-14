
from notebook.utils import url_path_join
from notebook.base.handlers import path_regex

from .projects import ProjectsHandler
from .share import ShareHandler
from .tree import TreeHandler
from .download import DownloadHandler
from ..filemanager.handlers import FetchHandler, ContentsHandler
import datetime

def load_jupyter_server_extension(nb_server_app):
    """ Used as a server extension in order to install the new handlers """

    new_handlers = [(r"/cernbox", TreeHandler),
                    (r"/cernbox%s" % path_regex, TreeHandler),
                    (r"/projects", ProjectsHandler),
                    (r"/projects%s" % path_regex, ProjectsHandler),
                    (r"/share", ShareHandler),
                    (r"/share%s" % path_regex, ShareHandler),
                    (r"/api/contents/fetch", FetchHandler),
                    (r"/api/swan/contents%s" % path_regex, ContentsHandler),
                    (r"/download", DownloadHandler)]

    web_app = nb_server_app.web_app

    # Calculate current year for copyright message
    nb_server_app.jinja_template_vars['current_year'] = datetime.datetime.now().year

    for handler in new_handlers:
        pattern = url_path_join(web_app.settings['base_url'], handler[0])
        new_handler = tuple([pattern] + list(handler[1:]))
        web_app.add_handlers('.*$', [new_handler])
