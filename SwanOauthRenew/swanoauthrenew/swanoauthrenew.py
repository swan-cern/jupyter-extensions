from notebook.base.handlers import IPythonHandler, FilesRedirectHandler, path_regex
from notebook.utils import url_path_join
from tornado import web, gen
from tornado.ioloop import PeriodicCallback
from traitlets.config import Config
from nbconvert import HTMLExporter
import nbformat
import logging
import os
import requests
from time import sleep
import jwt
from datetime import datetime


def refresh_token():
    r = requests.get(f"{os.environ['JUPYTERHUB_API_URL']}/user",
                     headers={"Authorization": f"token {os.environ['JUPYTERHUB_API_TOKEN']}"})
    access_token = jwt.decode(
        r.json()['auth_state']['access_token'].encode(), verify=False, algorithms='RS256')
    with open(os.environ['OAUTH2_FILE'], 'w') as f:
        f.write(
            f"oauth2:{r.json()['auth_state']['access_token']}:{os.environ['OAUTH_INSPECTION_ENDPOINT']}")
    ttl = access_token['exp']-int(datetime.now().timestamp())
    # to renew one minute before expiration
    ttl = ttl - 60
    if ttl < 60:
        ttl = 60
    log.info(f'next refresh in {ttl}s ')
    return ttl


def load_jupyter_server_extension(nb_server_app):
    """
    Called when the Jupyter server extension is loaded.

    Args:
        nb_server_app (NotebookWebApplication): handle to the Notebook webserver instance.
    """

    global log
    log = logging.getLogger('tornado.swanoauthrenew')
    log.name = "SwanOauthRenew"
    log.setLevel(logging.INFO)
    log.propagate = True

    log.info("Loading Server Extension")
    try:
        while True:
            ttl = refresh_token()
            sleep(ttl)
    except KeyError as e:
        log.info(f"one environment variable, {e}")
        log.info(f"is not set, so the extension f{__name__} is exiting ")
        return
