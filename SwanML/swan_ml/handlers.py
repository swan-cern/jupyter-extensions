from __future__ import annotations

import asyncio
import json
import logging

import tornado.web
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join

from swan_ml.config import SwanML
from swan_ml.ml import fetch_runs

logger = logging.getLogger(__name__)


class ListRunsHandler(APIHandler):
    """List pipeline runs."""

    @property
    def swan_config(self) -> SwanML:
        return self.settings["swan_ml_config"]

    @tornado.web.authenticated
    async def get(self):
        page_size = int(self.get_argument("page_size", "20"))
        page_token = self.get_argument("page_token", "")
        config = self.swan_config

        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, fetch_runs, page_size, page_token, config)
        self.finish(json.dumps(result))


def setup_handlers(web_app, config: SwanML):
    """Register API handlers with the Jupyter server."""
    base_url = web_app.settings["base_url"]
    web_app.settings["swan_ml_config"] = config

    handlers = [
        (
            url_path_join(base_url, "api", "mlcern", "runs"),
            ListRunsHandler,
        ),
    ]

    web_app.add_handlers(".*", handlers)
    logger.info(
        "Registered swan-ml API handlers at %sapi/mlcern/", base_url
    )
