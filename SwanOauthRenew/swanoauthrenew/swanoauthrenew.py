import logging
import os
import threading
import requests
import time
import jwt
from functools import reduce
from traitlets.config import Configurable
from traitlets import Tuple, List


class SwanOauthRenew(Configurable):

    files = List (
        Tuple(),
        default_value=[],
        config=True,
        help="""
        List of files to write the respective oauth token to.
        Each element needs to be a tuple of (file path, path to retrieve the token from auth state dict, text format)

        Examples:
            [
                ('/tmp/swan_oauth.token', 'access_token', '{token}'),
                ('/tmp/eos_oauth.token', 'exchanged_tokens/eos-service', 'oauth2:{token}:auth.cern.ch')
            ]
        """
    )

class TokenRefresher(threading.Thread):

    def __init__(self, log, config):
        self.log = log
        self.config = config
        self.api_url = os.environ['JUPYTERHUB_API_URL']
        self.api_token = os.environ['JUPYTERHUB_API_TOKEN']
        
        super(self.__class__, self).__init__()

    def run(self):
        while True:
            try:
                ttl = self.refresh_token()
                self.log.info(f'oAuth token refreshed. Next in {ttl}s')
            except Exception as e:
                self.log.error(f"Error renewing oAuth token: {str(e)}. Trying later.", exc_info=False)
                ttl = 60
            time.sleep(ttl)

    def refresh_token(self):
        r = requests.get(f"{self.api_url}/user",
                         headers={"Authorization": f"token {self.api_token}"})

        if r.status_code != requests.codes.ok:
            raise Exception(f'Non ok code accessing API: {r.status_code}')

        auth_state = r.json()['auth_state']
        ttl = -1

        for file, key, content in self.config.files:
            token = reduce(lambda x, y : x[y], key.split("/"), auth_state)
            # Write the token in the corresponding file, by using the given content format
            with open(file, 'w') as f:
                f.write(content.format(token = token))

            # renew one minute before expiration, but use the time of the token that will expire sooner
            token_decoded = jwt.decode(token, options={"verify_signature": False}, algorithms='RS256')
            token_ttl = token_decoded['exp'] - time.time() - 60

            if ttl == -1 or token_ttl < ttl:
                ttl = token_ttl

        # If the token has already expired, something went wrong but we'll try again later
        if ttl < 60:
            ttl = 60

        return ttl


def _load_jupyter_server_extension(serverapp):
    """
    Called when the Jupyter server extension is loaded.
    """
    log = logging.getLogger('tornado.swanoauthrenew')
    log.name = "SwanOauthRenew"
    log.setLevel(logging.INFO)
    log.propagate = True

    log.info("Loading Server Extension")

    config = SwanOauthRenew(config=serverapp.config)
    n_files = len(config.files)
    
    if n_files > 0:
        log.info(f"Loaded {n_files} files ")

        try:
            thread = TokenRefresher(log, config)
            thread.start()
        except KeyError as e:
            log.info(f"Environment variable {e} is not set. Exiting...")
    else:
        log.info(f"No files were configured. Exiting...")

