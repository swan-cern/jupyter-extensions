import shutil
from pathlib import Path
from typing import Any, Dict, Optional
import os

from jupyter_client import LocalProvisioner
from .config import SwanProjectsConfig


class SwanProvisioner(LocalProvisioner):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.swan_config = SwanProjectsConfig(config=self.config)

    async def pre_launch(self, **kwargs: Any) -> Dict[str, Any]:

        project_root = self._get_project_root(kwargs["cwd"])
        environment_file_path = Path()
        if project_root:
            self.log.info(f"Using project environment for {project_root}")
            environment_file_path = (
                project_root / self.swan_config.environment_file_name
            )
        else:
            self.log.info(f"Using default environment for kernel")
            environment_file_path = Path(self.swan_config.default_environment_file_path)

        if not environment_file_path.is_file():
            message = "Environment file not found in kernel provisioner"
            self.log.error(message)
            raise Exception(message)

        kwargs["env"] = dict()
        with open(environment_file_path) as f:
            for line in f.readlines():
                name, value = line.rstrip("\n").split("=", 1)
                kwargs["env"][name] = value

        self.kernel_spec.argv[0] = shutil.which(
            os.path.basename(self.kernel_spec.argv[0]),
            path=kwargs["env"].get("PATH", None),
        )
        if self.kernel_spec.argv[0] is None:
            raise Exception("This kernel is not avaialble in this enviornment.")
        return await super().pre_launch(**kwargs)

    def _get_project_root(self, path: str) -> Optional[Path]:
        cwd = Path(path)
        for parent in [cwd, *cwd.parents]:
            if (parent / self.swan_config.project_file_name).is_file():
                return parent
