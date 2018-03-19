

from notebook.base.handlers import IPythonHandler, path_regex
from notebook.utils import url_path_join
from tornado import web
from traitlets.config import Config
from nbconvert import HTMLExporter
import nbformat
import logging


class NotebookViewerHandler(IPythonHandler):
    """
        Jupyter server extension to provide a view-only mode to open notebooks.
        When users receive a shared project, now they can open it and use this extension
        to load the notebooks in view-mode (without the editing options that would allow
        the them to edit the document, even without permissions to save the changes).
        This creates a new endpoint called "notebook", followed by the path to the notebook
        (the normal, editable mode, is called "notebooks").
    """

    @web.authenticated
    def get(self, path):

        path = path.strip('/')
        cm = self.contents_manager

        log.info("Viewing notebook %s" % path)

        try:
            model = cm.get(path, content=True)
        except web.HTTPError as e:
            raise

        if model['type'] != 'notebook':
            # not a notebook, redirect to files
            return FilesRedirectHandler.redirect_to_files(self, path)

        html_exporter = HTMLExporter()
        html_exporter.template_file = 'basic'

        (body, resources) = html_exporter.from_notebook_node(model['content'])

        name = path.rsplit('/', 1)[-1]

        self.write(self.render_template('notebook_view.html',
            notebook_name=name,
            notebook=body,
            resources=resources
            )
        )
        self.finish()


def load_jupyter_server_extension(nb_server_app):
    """
    Called when the Jupyter server extension is loaded.

    Args:
        nb_server_app (NotebookWebApplication): handle to the Notebook webserver instance.
    """

    global log
    log = logging.getLogger('tornado.swannotebookviewer')
    log.name = "SwanNotebookViewer"
    log.setLevel(logging.INFO)
    log.propagate = True

    log.info("Loading Server Extension")

    web_app = nb_server_app.web_app
    host_pattern = ".*$"
    route_pattern = url_path_join(
        web_app.settings["base_url"], r"/notebook%s" % path_regex)
    web_app.add_handlers(host_pattern, [(route_pattern, NotebookViewerHandler)])
