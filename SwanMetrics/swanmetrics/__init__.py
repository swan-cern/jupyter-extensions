from __future__ import annotations
from jupyter_server_proxy.handlers import ProxyHandler

from prometheus_client import Counter
from ._version import __version__

from jupyter_server.base.handlers import PrometheusMetricsHandler

editors_opened = {
    "vscode": False
}

# Prometheus metrics
EDITORS_OPEN = Counter(
    "swan_editor_open",
    "Code editor usage in SWAN",
    ["editor"]
)

_original_prepare = ProxyHandler.prepare
def _wrapped_prepare(self, *args, **kwargs):
    path = self.request.path
    for editor, visited in editors_opened.items():
        if editor in path and not visited:
            EDITORS_OPEN.labels(editor=editor).inc()
            editors_opened[editor] = True
    return _original_prepare(self)
ProxyHandler.prepare = _wrapped_prepare

def _load_jupyter_server_extension(server_app) -> None:
    """
    Extension entry point. Called by Jupyter Server on startup.
    """
    log = server_app.log
    log.info(f"SwanMetrics: Loading version v{__version__}")

    web_app = server_app.web_app
    
    # Add route for Prometheus handler at the root level
    # so that Prometheus always scrapes the same endpoint,
    # without having to access /user/<username>/metrics every time.

    web_app.add_handlers(
        r".*$", 
        [(r"/metrics", PrometheusMetricsHandler)]
    )


def _jupyter_server_extension_points():
    """
    Returns the extension metadata for jupyter_server.

    This is required for `jupyter server extension enable` to work.
    """
    return [{"module": "swanmetrics"}]
