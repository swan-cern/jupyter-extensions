from tornado import web

from jupyter_server.base.handlers import JupyterHandler, APIHandler
from jupyter_server.utils import ensure_async
from ...filemanager.proj_url_checker import check_url
import json


class DownloadHandler(JupyterHandler):
    """Render the downloads view"""

    @web.authenticated
    def get(self):
        self.write(
            self.render_template(
                "download.html",
                page_title="Download",
            )
        )


class FetchHandler(APIHandler):
    """
    Handler for the API calls used by the fetcher.
    Asks the file manager to download the project provided and retrieves the path where it was stored.
    """

    def _finish_model(self, model):
        """Finish a JSON request with a model, setting relevant headers, etc."""
        self.set_header("Content-Type", "application/json")
        self.finish(json.dumps(model))

    @web.authenticated
    async def get(self):
        url = self.get_query_argument("url", default=None)
        if not url:
            raise web.HTTPError(400, "No url provided")
        check_url(url)

        try:
            model = await ensure_async(self.contents_manager.download(url=url))
            self._finish_model(model)
        except Exception as e:
            # Clean the error and show only the message
            raise web.HTTPError(400, str(e))
