# SwanAI

A JupyterLab chat sidebar for SWAN that talks to AI providers **through their HTTP APIs**.

Unlike [`jupyter-ai`](https://jupyter-ai.readthedocs.io) 3.x, which drives external agent CLIs
(`claude`, `codex`, `copilot`) over the Agent Client Protocol, SwanAI only needs the vendors'
Python SDKs. Nothing extra is installed in the SWAN images: no CLI binaries, no npm ACP adapters,
no subprocesses.

Supported providers:

| Provider           | Package    | Default model  |
| ------------------ | ---------- | -------------- |
| Anthropic (Claude) | `anthropic`| `claude-opus-5`|
| OpenAI             | `openai`   | `gpt-5`        |

## How it works

- The **frontend** is a React widget in the right sidebar. It keeps the conversation in the
  browser and sends the history it wants the model to see on every request.
- The **server extension** holds the API keys, builds the provider client, and streams the answer
  back as Server-Sent Events. It is stateless between requests.
- Both halves speak one small event vocabulary (`start`, `thinking`, `delta`, `usage`, `done`,
  `error`), so adding a provider does not touch the frontend.

Answers are rendered with JupyterLab's own markdown renderer, so code highlighting and LaTeX
behave exactly as in a notebook. Each answer can be copied, or inserted into a new cell below the
active cell of the current notebook.

## API keys

Each user provides their own key, in the **Keys** panel of the sidebar.

Keys are stored server-side, in `~/.swan/swanai/credentials.json`, created with mode `0600`
inside a `0700` directory. They never reach the browser and are never logged: the UI only ever
shows a fragment such as `sk-ant-…WXYZ`.

If `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set in the session environment, that key is used
for the corresponding provider when the user has not saved one; the UI shows it as provided by
the session and does not let the user overwrite or delete it.

## Configuration

All the traits below live under `SwanAI` in `jupyter_server_config.py`:

```python
c.SwanAI.enabled_providers = ["anthropic"]                 # hide a provider entirely
c.SwanAI.default_provider = "anthropic"
c.SwanAI.default_model = "claude-opus-5"
c.SwanAI.model_allowlist = {                               # restrict the model picker
    "anthropic": ["claude-opus-5", "claude-haiku-4-5"],
}
c.SwanAI.max_tokens = 16000                                # cap on a single answer
c.SwanAI.effort = "high"                                   # low | medium | high | xhigh | max
c.SwanAI.system_prompt = "..."                             # SWAN-aware prompt by default
c.SwanAI.credentials_path = "~/.swan/swanai/credentials.json"
c.SwanAI.allow_user_credentials = True                     # False hides the key UI
c.SwanAI.max_history_messages = 200                        # request validation limits
c.SwanAI.max_request_chars = 1_000_000
```

When `model_allowlist` has no entry for a provider, the models that provider advertises to the
configured key are all offered.

## Endpoints

| Route                      | Method        | Purpose                                                       |
| -------------------------- | ------------- | ------------------------------------------------------------- |
| `/api/swanai/config`       | `GET`         | Providers, models, defaults, key status. Never returns a key.  |
| `/api/swanai/models`       | `GET`         | Models the configured key can actually use.                    |
| `/api/swanai/credentials`  | `POST`/`DELETE` | Store or remove one provider's key.                          |
| `/api/swanai/chat`         | `POST`        | Server-Sent Events stream of one answer.                       |

The chat stream sends a `: keepalive` comment every 5 seconds while the model is silent, since
SWAN sits behind an nginx proxy with a 60 second idle timeout, and sets `X-Accel-Buffering: no`
so the proxy does not buffer the answer. Closing the connection (the **Stop** button, a reload,
a closed tab) stops the generation server-side.

## Install

```bash
pip install swan-ai
```

The wheel ships the prebuilt labextension and enables the server extension, so there is nothing
else to run.

## Development

```bash
pip install -e .          # builds the labextension through hatch-jupyter-builder
jlpm build                # rebuild the frontend after a change
jlpm watch                # or rebuild continuously
jupyter labextension list # swan-ai should be "enabled OK"
```

Checks:

```bash
jlpm lint                                                    # eslint, stylelint, prettier
uvx ruff check swan_ai && uvx ruff format --check swan_ai
uv run --group dev pytest                                    # credential store, providers, validation
```

## Not included

SwanAI is a chat panel. It cannot read or edit the user's files — that is what the CLI agents
`jupyter-ai` drives are for. Doing that over the APIs means running a tool loop server-side, and
would be added as new event types on the existing provider interface. Cell magics and
notebook-context features (`explain this traceback`) are likewise not part of this version.
