
from nbclassic.tree.handlers import TreeHandler
from jupyter_server.base.handlers import path_regex
from jupyter_server.utils import url_path_join, url_escape


class CernboxHandler(TreeHandler):
    """ Render the CERNBox view, listing notebooks, etc """

    def generate_breadcrumbs(self, path):
        """ Generate array of breadcrumb to display in page """
        breadcrumbs = [(url_path_join(self.base_url, 'cernbox'), '')]
        parts = path.split('/')
        for i in range(len(parts)):
            if parts[i]:
                link = url_path_join(self.base_url, 'cernbox',
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
            return 'CERNBox - ' + page_title
        else:
            return 'CERNBox'

#-----------------------------------------------------------------------------
# URL to handler mappings
#-----------------------------------------------------------------------------


default_handlers = [
    (r"/cernbox%s" % path_regex, CernboxHandler),
]