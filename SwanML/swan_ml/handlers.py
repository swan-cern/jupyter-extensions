from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

import tornado.web
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join

from swan_ml.config import SwanML
from swan_ml.ml import get_kfp_client

logger = logging.getLogger(__name__)


class ListRunsHandler(APIHandler):
    """List pipeline runs."""

    @property
    def swan_config(self) -> SwanML:
        return self.settings["swan_ml_config"]

    @tornado.web.authenticated
    async def get(self):
        try:
            page_size = int(self.get_argument("page_size", "20"))
            page_token = self.get_argument("page_token", "")

            config = self.swan_config

            def _fetch():
                client = get_kfp_client(
                    token_path=Path(config.token_path),
                    host=config.kubeflow_host,
                )
                response = client.list_runs(
                    page_size=page_size,
                    page_token=page_token or None,
                    sort_by="created_at desc",
                )

                runs = []
                for run in response.runs or []:
                    runs.append(
                        {
                            "id": run.run_id,
                            "name": run.display_name,
                            "state": run.state,
                            "created_at": str(run.created_at),
                            "finished_at": (
                                str(run.finished_at) if run.finished_at else None
                            ),
                            "url": f"{config.kubeflow_host}/#/runs/details/{run.run_id}",
                        }
                    )
                return {
                    "runs": runs,
                    "next_page_token": response.next_page_token or None,
                    "total_size": response.total_size,
                }


            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(None, _fetch)
            self.finish(json.dumps(result))

        except Exception as exc:
            logger.exception("Failed to list runs")
            self.set_status(500)
            self.finish(json.dumps({"error": str(exc)}))


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
