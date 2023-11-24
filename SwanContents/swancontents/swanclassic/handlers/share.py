from tornado import web

from jupyter_server.base.handlers import JupyterHandler
from jupyter_server.extension.handler import (
    ExtensionHandlerMixin,
    ExtensionHandlerJinjaMixin
)
from jupyter_server.base.handlers import path_regex
from jupyter_server.utils import url_path_join, url_escape, ensure_async
from ...filemanager.eos.fileio import swan_sharing_folder


class ShareHandler(ExtensionHandlerJinjaMixin, ExtensionHandlerMixin, JupyterHandler):
    """ Render the Share page """

    def generate_breadcrumbs(self, path):
        """ Generate array of breadcrumb to display in page """
        breadcrumbs = [(url_path_join(self.base_url, 'projects'), '')]
        parts = path.split('/')
        for i in range(len(parts)):
            if parts[i]:
                link = url_path_join(self.base_url, 'share',
                                     url_escape(url_path_join(*parts[:i + 1])),
                                     )
                breadcrumbs.append((link, parts[i]))
        return breadcrumbs

    @web.authenticated
    async def get(self, path=''):

        # If path is empty, show the base page with the list of projects shared by me and with me.
        if path == '':
            self.write(self.render_template('tree.html',
                                            page_title='Shares',
                                            terminals_available=self.settings['terminals_available'],
                                            server_root=self.settings['server_root_dir'],
                                            share_page=True,
                                            share_tree=False,
                                            ))
        else:
            path = path.strip('/')
            cm = self.contents_manager
            dir_exists = await ensure_async(cm.dir_exists(path=swan_sharing_folder + path))

            if dir_exists:
                breadcrumbs = self.generate_breadcrumbs(path)
                self.write(self.render_template('tree.html',
                                                page_title='Share - ' + path,
                                                terminals_available=self.settings['terminals_available'],
                                                notebook_path=swan_sharing_folder + path,
                                                breadcrumbs=breadcrumbs,
                                                share_page=True,
                                                share_tree=True,
                                                ))
            else:
                raise web.HTTPError(404)

#-----------------------------------------------------------------------------
# URL to handler mappings
#-----------------------------------------------------------------------------


default_handlers = [
    (r"/share%s" % path_regex, ShareHandler),
]