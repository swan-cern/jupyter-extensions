from __future__ import annotations
from jupyter_server_proxy.handlers import ProxyHandler

from prometheus_client import Counter
from ._version import __version__
from typing import Any
import logging

from jupyter_server.base.handlers import PrometheusMetricsHandler

editors_opened = {
    "vscode": False
}

KERNEL_ACTIONS_SCHEMA_ID = "https://events.jupyter.org/jupyter_server/kernel_actions/v1"

# Prometheus metrics
EDITORS_OPEN = Counter(
    "swan_editor_open",
    "Code editor usage in SWAN",
    ["editor"]
)

KERNEL_EVENTS = Counter(
    "swan_kernel_events",
    "Total kernel lifecycle events",
    ["action", "kernel_name", "status"],
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

async def kernel_event_listener(
    *,
    logger,
    schema_id: str,
    data: dict[str, Any],
) -> None:
    """
    Async callback invoked when kernel_actions events are emitted.

    This is registered with jupyter_events and called for every kernel action.
    """
    
    KERNEL_EVENTS.labels(
        action=data.get("action", "?"),
        kernel_name=data.get("kernel_name", "?"),
        status=data.get("status", "?"),
    ).inc()

def _load_jupyter_server_extension(server_app) -> None:
    """
    Extension entry point. Called by Jupyter Server on startup.
    """
    log = server_app.log
    log.info(f"SwanMetrics: Loading version v{__version__}")

    event_logger = server_app.event_logger

    # Events only flow if handlers AND listeners exist.
    # Without handlers, emit() returns early and skips listeners.
    if not event_logger.handlers:
        import sys

        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.WARNING)
        handler.setFormatter(logging.Formatter("%(message)s"))
        event_logger.register_handler(handler)

    # Register the async listener for kernel actions
    event_logger.add_listener(
        schema_id=KERNEL_ACTIONS_SCHEMA_ID, listener=kernel_event_listener
    )

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
