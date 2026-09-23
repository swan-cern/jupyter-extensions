from traitlets import Bool, Dict, Int, List, Unicode
from traitlets.config import Configurable

DEFAULT_SYSTEM_PROMPT = (
    "You are an AI assistant embedded in SWAN, the CERN Service for Web based ANalysis. "
    "Users work in JupyterLab notebooks on CERN infrastructure, typically with Python, ROOT, "
    "PySpark, Dask and HTCondor, on data stored in EOS or CERNBox. "
    "Answer concisely and prefer runnable code. When you write code, put it in a fenced block "
    "with the language tagged so it can be copied into a notebook cell. "
    "You cannot read or modify the user's files: if you need the contents of a notebook, a "
    "traceback or a data sample, ask the user to paste it."
)


class SwanAI(Configurable):
    """swan-ai configuration"""

    credentials_path = Unicode(
        "~/.swan/swanai/credentials.json",
        help=(
            "Path to the per-user file holding the AI provider API keys. "
            "Created with mode 0600 inside a 0700 directory."
        ),
    ).tag(config=True)

    allow_user_credentials = Bool(
        True,
        help=(
            "Whether users may set their own API keys through the UI. "
            "Set to False when keys are provided centrally through the environment; "
            "the key management UI is then hidden."
        ),
    ).tag(config=True)

    enabled_providers = List(
        Unicode(),
        default_value=["anthropic", "openai"],
        help="Providers offered to the user, in the order they are shown.",
    ).tag(config=True)

    default_provider = Unicode(
        "anthropic",
        help="Provider preselected in the chat panel.",
    ).tag(config=True)

    default_model = Unicode(
        "claude-opus-5",
        help="Model preselected for the default provider.",
    ).tag(config=True)

    model_allowlist = Dict(
        value_trait=List(Unicode()),
        key_trait=Unicode(),
        default_value={},
        help=(
            "Optional per-provider list of model ids the user may pick, e.g. "
            "{'anthropic': ['claude-opus-5', 'claude-haiku-4-5']}. "
            "When a provider is absent from this dict, the models it advertises are all offered."
        ),
    ).tag(config=True)

    max_tokens = Int(
        16000,
        help="Upper bound on the tokens generated for a single answer.",
    ).tag(config=True)

    effort = Unicode(
        "high",
        help="Reasoning effort for models that support it: low, medium, high, xhigh or max.",
    ).tag(config=True)

    system_prompt = Unicode(
        DEFAULT_SYSTEM_PROMPT,
        help="System prompt prepended to every conversation.",
    ).tag(config=True)

    max_history_messages = Int(
        200,
        help="Maximum number of messages accepted in a single chat request.",
    ).tag(config=True)

    max_request_chars = Int(
        1_000_000,
        help="Maximum total size, in characters, of the conversation accepted in a chat request.",
    ).tag(config=True)
