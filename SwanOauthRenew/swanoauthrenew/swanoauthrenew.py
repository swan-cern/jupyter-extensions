import logging
import os
import threading
import requests
from time import sleep
import jwt
from datetime import datetime


class TokenRefresher(threading.Thread):

    def __init__(self, log):
        self.log = log
        self.api_url = os.environ['JUPYTERHUB_API_URL']
        self.api_token = os.environ['JUPYTERHUB_API_TOKEN']
        self.auth_file = os.environ['OAUTH2_FILE']
        self.inspection_url = os.environ['OAUTH_INSPECTION_ENDPOINT']
        
        super(self.__class__, self).__init__()

    def run(self):
        while True:
            try:
                ttl = self.refresh_token()
                self.log.info(f'oAuth token refreshed. Next in {ttl}s')
            except:
                self.log.error(
                    "Error renewing oAuth token. Trying later.", exc_info=True)
                ttl = 60
            sleep(ttl)

    def refresh_token(self):
        r = requests.get(f"{self.api_url}/user",
                         headers={"Authorization": f"token {self.api_token}"})

        access_token = r.json()['auth_state']['access_token']
        access_token_decoded = jwt.decode(
            access_token, verify=False, algorithms='RS256')

        # Replace the token in the file observed by EOS
        with open(self.auth_file, 'w') as f:
            f.write("oauth2:%s:%s" % (access_token, self.inspection_url))

        # renew one minute before expiration
        ttl = access_token_decoded['exp'] - int(datetime.now().timestamp())
        ttl = ttl - 60

        # If the token has already expired, something went wrong but we'll try again later
        if ttl < 60:
            ttl = 60

        return ttl


def load_jupyter_server_extension(nb_server_app):
    """
    Called when the Jupyter server extension is loaded.

    Args:
        nb_server_app (NotebookWebApplication): handle to the Notebook webserver instance.
    """
    log = logging.getLogger('tornado.swanoauthrenew')
    log.name = "SwanOauthRenew"
    log.setLevel(logging.INFO)
    log.propagate = True

    log.info("Loading Server Extension")
    try:
        thread = TokenRefresher(log)
        thread.start()
    except KeyError as e:
        log.info(f"Environment variable {e} is not set. Exiting...")
