import argparse
import logging
import socket
from functools import partialmethod

from dask_labextension import load_jupyter_server_extension
from dask_labextension.dashboardhandler import DaskDashboardHandler
from tornado import ioloop, web

# Prevent exceptions from trying to create an html error response
# Otherwise, we would need to configure the templates
from jupyter_server.base.handlers import JupyterHandler, APIHandler
JupyterHandler.write_error = APIHandler.write_error

class WebApp:
    pass

def _set_dashboard_whitelist():
    '''
    Ask Jupyter proxy server to whitelist the current hostname so that queries
    to the Dask dashboard succeed.
    '''
    private_ip = socket.gethostbyname(socket.gethostname())

    def custom_init(self, *args, **kwargs):
        super(DaskDashboardHandler, self).__init__(*args,
                                                   host_whitelist=[private_ip],
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

    # Prevent 403 errors when querying the dashboard server
    _set_dashboard_whitelist()

    # If no remote access allowed, Jupyter will check if we're serving from https://localhost
    app = web.Application(base_url=args.base_url, allow_remote_access=True)

    server_app = WebApp()
    server_app.web_app = app
    load_jupyter_server_extension(server_app)

    app.listen(args.port)
    ioloop.IOLoop.current().start()
