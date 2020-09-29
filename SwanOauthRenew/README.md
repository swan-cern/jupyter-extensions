# SwanOauthRenew

Extension that refreshes the Oauth token 

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

This extension updates the oauth2 token in the file pointed by the environment variable OAUTH2_FILE.
