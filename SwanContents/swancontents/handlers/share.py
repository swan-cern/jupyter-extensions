from tornado import web
from notebook.base.handlers import IPythonHandler, path_regex
from notebook.utils import url_path_join, url_escape
from ..filemanager.fileio import swan_sharing_folder


class ShareHandler(IPythonHandler):
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
    def get(self, path=''):

        # If path is empty, show the base page with the list of projects shared by me and with me.
        if path == '':
            self.write(self.render_template('tree.html',
                                            page_title='Share',
                                            terminals_available=self.settings['terminals_available'],
                                            server_root=self.settings['server_root_dir'],
                                            share_page=True,
                                            share_tree=False,
                                            ))
        else:
            path = path.strip('/')
            if self.contents_manager.dir_exists(path=swan_sharing_folder + path):
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
