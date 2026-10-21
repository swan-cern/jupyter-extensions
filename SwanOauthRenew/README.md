# SwanOauthRenew

This is a server extension that fetches the oAuth tokens from the JupyterHub API and stores them in files that can be accessed by other processes (like the EOS client). It can be configured to take any token from the auth state dictionary and write it with any content format.

## Requirements

* notebook

## Install

```bash
pip install swanoauthrenew
```

## Usage

In your JupyterHub configuration, add the `admin:auth_state!user` scope to both the `user` and `server` roles to allow the extension to fetch the authentication state for the user:

```python
c.JupyterHub.load_roles = [
    {"name": "user", "scopes": ["self", "admin:auth_state!user"]},
    {
        "name": "server",
        "scopes": [
            "access:servers!user",
            "users:activity!user",
            "admin:auth_state!user",
        ],
    },
]
```

Configure the server extension to load when the notebook server starts:

```bash
jupyter serverextension enable --py --user swanoauthrenew
```

Then is necessary to configure (in the jupyter config file) the files that need to be written, from where the tokens are coming from and how the file content should look like. Like so:

```python
c.SwanOauthRenew.files = [
    ("/tmp/swan_oauth.token", "access_token", "{token}"),
    ("/tmp/cernbox_oauth.token", "exchanged_tokens/cernbox-service", "{token}"),
    ("/tmp/eos_oauth.token", "exchanged_tokens/eos-service", "oauth2:{token}:auth.cern.ch"),
]
```
