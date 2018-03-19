
from tornado import web
from notebook.base.handlers import IPythonHandler, path_regex
from notebook.utils import url_path_join, url_escape


class ProjectsHandler(IPythonHandler):
    """ Render the projects view, listing projects, notebooks, etc """

    def generate_breadcrumbs(self, path):
        """ Generate array of breadcrumb to display in page """
        breadcrumbs = [(url_path_join(self.base_url, 'projects'), '')]
        parts = path.split('/')
        for i in range(len(parts)):
            if parts[i]:
                link = url_path_join(self.base_url, 'projects',
                                     url_escape(url_path_join(*parts[:i+1])),
                                     )
                breadcrumbs.append((link, parts[i]))
        return breadcrumbs

    def generate_page_title(self, path):
        """ Page title  """
        comps = path.split('/')
        if len(comps) > 3:
            for i in range(len(comps)-2):
                comps.pop(0)
        page_title = url_path_join(*comps)
        if page_title:
            return 'My Projects - ' + page_title
        else:
            return 'My Projects'

    @web.authenticated
    def get(self, path=''):
        """ Get handler to cope with Projects as root folder """
        path = path.strip('/')
        cm = self.contents_manager

        swan_path = url_path_join('SWAN_projects', path)

        if cm.dir_exists(path=swan_path):
            if cm.is_hidden(swan_path):
                self.log.info("Refusing to serve hidden directory, via 404 Error")
                raise web.HTTPError(404)

            if path != '':
                parent_project = cm._get_project_path(swan_path)
                if not parent_project or parent_project == 'invalid':
                    self.log.info("Trying to see a folder inside Projects")
                    raise web.HTTPError(404)
            breadcrumbs = self.generate_breadcrumbs(path)
            page_title = self.generate_page_title(path)
            self.write(self.render_template('tree.html',
                                            page_title=page_title,
                                            notebook_path=swan_path,
                                            breadcrumbs=breadcrumbs,
                                            terminals_available=self.settings['terminals_available'],
                                            server_root=self.settings['server_root_dir'],
                                            projects_page=True,
                                            ))
        elif cm.file_exists(swan_path):
            # it's not a directory, we have redirecting to do
            model = cm.get(swan_path, content=False)
            # redirect to /api/notebooks if it's a notebook, otherwise /api/files
            service = 'notebooks' if model['type'] == 'notebook' else 'files'
            url = url_path_join(
                self.base_url, service, url_escape(swan_path),
            )
            self.log.debug("Redirecting %s to %s", self.request.swan_path, url)
            self.redirect(url)
        else:
            raise web.HTTPError(404)
