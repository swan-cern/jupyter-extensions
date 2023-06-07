
from tornado import web
from notebook.base.handlers import IPythonHandler, path_regex
from notebook.utils import url_path_join, url_escape


class DownloadHandler(IPythonHandler):
    """ Render the downloads view """

    @web.authenticated
    def get(self):
            self.write(self.render_template('download.html',
                                            page_title='Download',
                                            ))
