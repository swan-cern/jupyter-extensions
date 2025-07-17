import argparse
import logging
import socket
from functools import partialmethod

from dask_labextension import load_jupyter_server_extension
from dask_labextension.dashboardhandler import DaskDashboardHandler
from tornado import ioloop, web

from jupyter_server.base.handlers import JupyterHandler, APIHandler


class WebApp:
    pass


def _patch_handlers():
    # Prevent exceptions from trying to create an html error response
    # Otherwise, we would need to configure the templates
    JupyterHandler.write_error = APIHandler.write_error

    # The endpoint is already protected by jupyter-server-proxy
    # So we fake a logged in user to prevent the extension from failing
    # with lack of valid auth
    JupyterHandler._jupyter_current_user = "nobody"


def _set_dashboard_whitelist():
    '''
    Ask Jupyter proxy server to whitelist the current hostname so that queries
    to the Dask dashboard succeed.
    '''
    private_ip = socket.gethostbyname(socket.gethostname())

    def custom_init(self, *args, **kwargs):
        super(DaskDashboardHandler, self).__init__(*args,
                                                   host_allowlist=[private_ip],
                                                   *kwargs)

    DaskDashboardHandler.__init__ = partialmethod(custom_init)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", default=9191, type=int, action="store", dest="port")
    parser.add_argument("--base_url", default="/", action="store", dest="base_url")
    args = parser.parse_args()

    log = logging.getLogger("tornado.swandask")
    log.name = "SwanDask"
    log.setLevel(logging.INFO)
    log.propagate = True
    log.info(f"Running SwanDask on port {args.port} with base url {args.base_url}")

    # Patch the Jupyter and tornado handlers to avoid configuring all
    # parameters in the web.Application bellow
    _patch_handlers()

    # Prevent 403 errors when querying the dashboard server
    _set_dashboard_whitelist()

    # Create a dummy IdentityProvider
    # We don't use it, but this way we remove a warning of deprecation
    # This requires Jupyter Server > 2, so it will fail if older
    try:
        from jupyter_server.auth import IdentityProvider
        from traitlets.config import Configurable
        identity_provider = IdentityProvider(parent=Configurable())
    except:
        identity_provider = None

    app = web.Application(
        base_url=args.base_url,
        allow_remote_access=True,
        identity_provider=identity_provider
    )

    server_app = WebApp()
    server_app.web_app = app
    load_jupyter_server_extension(server_app)

    app.listen(args.port)
    ioloop.IOLoop.current().start()
