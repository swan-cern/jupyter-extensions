
from tornado import web
from notebook.base.handlers import IPythonHandler, path_regex


class ShareHandler(IPythonHandler):
    """ Render the Share page """

    @web.authenticated
    def get(self):

        self.write(self.render_template('tree.html',
                                        page_title='Share',
                                        terminals_available=self.settings['terminals_available'],
                                        server_root=self.settings['server_root_dir'],
                                        share_page=True,
                                        ))
