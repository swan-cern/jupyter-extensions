from traitlets import Unicode
from traitlets.config import Configurable


class SwanML(Configurable):
    """swan-ml configuration"""

    token_path = Unicode(
        "/tmp/kubeflow_ml_oauth.token",
        help="Path to the OAuth token file used to authenticate with Kubeflow.",
    ).tag(config=True)

    kubeflow_host = Unicode(
        "https://ml.cern.ch/pipeline",
        help="URL of the Kubeflow Pipelines API endpoint.",
    ).tag(config=True)
