from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from traitlets import Unicode
from traitlets.config import Configurable
from tornado import web
import requests
import time
import jwt



class SwanShare(Configurable):

    token_file = Unicode(
        '/tmp/swan_oauth.token', config=True, help='Path to the token file used for authenticate'
    )

    cernbox_url = Unicode(
        'https://cernbox.cern.ch', config=True, help='URL of the CERNBox instance to auth'
    )


class SwanShareHandler(APIHandler):

    config = None

    def initialize(self):
        self.config = SwanShare(config=self.config)

    @web.authenticated
    def get(self):

        origin = self.get_query_argument('origin')

        with open(self.config.token_file, 'r') as f:
            token = f.read()
            token_decoded = jwt.decode(token, options={"verify_signature": False}, algorithms='RS256')
            
            if token_decoded['exp'] < time.time():
                raise web.HTTPError(400, u'Token expired')
                
            r = requests.get(f"{self.config.cernbox_url}/swanapi/v2/authenticate",
                                headers={
                                    "Authorization": f"bearer {token}",
                                    "Origin": origin
                                })

            if r.status_code != requests.codes.ok:
                raise web.HTTPError(400, f'Non ok code accessing API: {r.status_code}')
            
            self.finish(r.json())


def _load_jupyter_server_extension(serverapp):
    """
    Called when the Jupyter server extension is loaded.

    Args:
        nb_server_app (NotebookWebApplication): handle to the Notebook webserver instance.
    """
    web_app = serverapp.web_app
    host_pattern = ".*$"
    route_pattern = url_path_join(
        web_app.settings["base_url"], r"/api/swanshare")
    web_app.add_handlers(host_pattern, [(route_pattern, SwanShareHandler)])