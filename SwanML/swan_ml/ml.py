from pathlib import Path

import jwt
import kfp


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
