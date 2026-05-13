import logging
from pathlib import Path

import jwt
import kfp
import kfp_server_api

from swan_ml.config import SwanML


def read_token(path: Path) -> str:
    return path.read_text(encoding="utf-8").strip()


def get_namespace_from_token(token: str) -> str:
    decoded = jwt.decode(token, options={"verify_signature": False})
    return decoded["sub"]


def get_kfp_client(token_path: Path, host: str) -> kfp.Client:
    token = read_token(token_path)
    namespace = get_namespace_from_token(token)
    return kfp.Client(
        host=host,
        existing_token=token,
        namespace=namespace,
    )


def fetch_runs(page_size: int, page_token: str, config: SwanML, log: logging.Logger) -> dict:
    """Fetch runs from Kubeflow."""

    client = get_kfp_client(
        token_path=Path(config.token_path),
        host=config.kubeflow_host,
    )
    try:
        response = client.list_runs(
            page_size=page_size,
            page_token=page_token,
            sort_by="created_at desc",
        )
    except kfp_server_api.exceptions.ApiException as e:
        if e.reason == "Forbidden":
            # This can happen if the user never logged in to Kubeflow before.
            # In this case, we just return an empty list instead of showing an error.
            log.info("Kubeflow returned 403 Forbidden when listing runs; returning empty list")
            return {
                "runs": [],
                "next_page_token": '',
                "total_size": 0,
            }
        raise


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
        "next_page_token": response.next_page_token or '',
        "total_size": response.total_size,
    }
