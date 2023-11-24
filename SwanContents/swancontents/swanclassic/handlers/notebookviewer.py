from tornado import web
from jupyter_server.base.handlers import JupyterHandler, FilesRedirectHandler
from jupyter_server.extension.handler import (
    ExtensionHandlerMixin,
    ExtensionHandlerJinjaMixin,
)
from jupyter_server.base.handlers import path_regex
from jupyter_server.utils import ensure_async
from nbconvert import HTMLExporter

has_voila = False
try:
    import voila

    has_voila = True
except:
    pass


class NotebookViewerHandler(
    ExtensionHandlerJinjaMixin, ExtensionHandlerMixin, JupyterHandler
):
    """
    Jupyter server extension to provide a view-only mode to open notebooks.
    When users receive a shared project, now they can open it and use this extension
    to load the notebooks in view-mode (without the editing options that would allow
    them to edit the document, even without permissions to save the changes).
    This creates a new endpoint called "notebook", followed by the path to the notebook
    (the normal, editable mode, is called "notebooks").
    """

    @web.authenticated
    async def get(self, path=""):
        path = path.strip("/")
        cm = self.contents_manager

        self.log.info("Viewing notebook %s" % path)

        try:
            model = await ensure_async(cm.get(path, content=True))
        except web.HTTPError as e:
            raise

        if model["type"] != "notebook":
            # not a notebook, redirect to files
            return FilesRedirectHandler.redirect_to_files(self, path)

        html_exporter = HTMLExporter()
        html_exporter.template_name = "classic"

        (body, resources) = html_exporter.from_notebook_node(model["content"])

        name = path.rsplit("/", 1)[-1]

        original_path = path
        if "clone_url" in model:
            path = model["clone_url"]
            if model["clone_url"] and self.get_argument("clone_folder", False):
                path = path.split("/")
                path.pop(-1)
                path = "/".join(path)

        self.write(
            self.render_template(
                "notebook_view.html",
                notebook_name=name,
                path=original_path,
                notebook=body,
                resources=resources,
                voila=has_voila,
                clone_url=path,
                base_url=self.base_url,
            )
        )
        self.finish()


# -----------------------------------------------------------------------------
# URL to handler mappings
# -----------------------------------------------------------------------------


default_handlers = [
    (r"/notebook%s" % path_regex, NotebookViewerHandler),
]
