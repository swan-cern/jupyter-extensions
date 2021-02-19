# SwanOauthRenew

This is a server extension that fetches the oAuth tokens available in the "user" endpoint of the JupyterHub API (1) and stores them in files that can be accessed by other processes (like the EOS client). It can be configured to take any token from the auth state dictionary and write it with any content format.

(1) For now, this functionality is exclusive to SwanHub (our JH wrapper). It does not work on vanilla JH, as the auth state is only available to admins.

## Requirements

* notebook

## Install

```bash
pip install swanoauthrenew
```

## Usage

Configure the server extension to load when the notebook server starts

```bash
 jupyter serverextension enable --py --user swanoauthrenew
```

Then is necessary to configure (in the jupyter config file) the files that need to be written, from where the tokens are coming from and how the file content should look like. Like so:

```python
c.SwanOauthRenew.files = [
        ('/tmp/swan_oauth.token', 'access_token', '{token}'),
        ('/tmp/cernbox_oauth.token', 'exchanged_tokens/cernbox-service', '{token}'),
        ('/tmp/eos_oauth.token', 'exchanged_tokens/eos-service', 'oauth2:{token}:auth.cern.ch')
    ]
```
