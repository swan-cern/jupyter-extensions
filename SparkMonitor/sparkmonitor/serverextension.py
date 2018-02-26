"""SparkMonitor Jupyter Web Server Extension

This module adds a custom request handler to Jupyter web server.
It proxies the Spark Web UI by default running at 127.0.0.1:4040
to the endpoint notebook_base_url/sparkmonitor
"""

from notebook.base.handlers import IPythonHandler
import tornado.web
from tornado import httpclient
import json
import re
import os
import logging
from traitlets.config import LoggingConfigurable
from traitlets.traitlets import Unicode
from bs4 import BeautifulSoup

proxy_root = "/sparkmonitor"


class SparkMonitorHandler(IPythonHandler):
    """A custom tornado request handler to proxy Spark Web UI requests."""

    http = httpclient.AsyncHTTPClient()

    @tornado.web.asynchronous
    def get(self):
        """Handles get requests to the Spark UI

        Fetches the Spark Web UI from the configured ports
        """
        # Without protocol and trailing slash
        baseurl = os.environ.get("SPARKMONITOR_UI_HOST", "127.0.0.1")
        port = os.environ.get("SPARKMONITOR_UI_PORT", "4040")
        url = "http://" + baseurl + ":" + port

        self.request_path = self.request.uri[(
            self.request.uri.index(proxy_root) + len(proxy_root) + 1):]

        self.replace_path = self.request.uri[:self.request.uri.index(
            proxy_root) + len(proxy_root)]

        log.debug("GET: Request uri:%s Port: %s request_path: %s replace_path: %s", self.request.uri, port, self.request_path, self.replace_path)

        # Due to a bug in yarn the query parameters are dropped when redirecting
        # Workaround: fetch the redirect url of the base path and use that url to fetch the real files
        if self.request_path:
            self.fetch_url(url)
        else:
            self.fetch_content(url)


    def fetch_url(self, url):
        """Fetches the root url to get the redirection url"""
        log.debug("Fetching redirection url from: %s", url)
        self.http.fetch(url, self.handle_url_response)


    def handle_url_response(self, response):
        """Gets the redirection url and uses that as base url to fetch the content"""
        if response.error:
            self.handle_content_response(response)
        else:
            url = url_path_join(response.effective_url, self.request_path)
            self.fetch_content(url)


    def fetch_content(self, url):
        """Fetches the requested content"""
        log.debug("Fetching content from: %s", url)
        self.http.fetch(url, self.handle_content_response)


    def handle_content_response(self, response):
        """Sends the fetched page as response to the GET request"""

        if response.error:
            content_type = "application/json"
            content = json.dumps({"error": "SPARK_UI_NOT_RUNNING",
                                  "backendurl": response.effective_url, "replace_path": self.replace_path})
            log.debug("Spark UI not running")

        else:
            content_type = response.headers["Content-Type"]
            if "text/html" in content_type:
                content = replace(response.body, self.replace_path)
            elif "javascript" in content_type:
                content = response.body.decode().replace(
                    "location.origin", "location.origin +'" + self.replace_path + "' ")
            else:
                # Probably binary response, send it directly.
                content = response.body

        self.set_header("Content-Type", content_type)
        self.write(content)
        self.finish()


def load_jupyter_server_extension(nb_server_app):
    """
    Called when the Jupyter server extension is loaded.

    Args:
        nb_server_app (NotebookWebApplication): handle to the Notebook webserver instance.
    """
    # Configuring logging for the extension
    # This is necessary because in some versions of jupyter, print statements are not output to console.

    global log
    log = logging.getLogger('tornado.sparkmonitor.server')
    log.name = "SparkMonitorServer"
    log.setLevel(logging.INFO)
    log.propagate = True

    log.info("Loading Server Extension")

    web_app = nb_server_app.web_app
    host_pattern = ".*$"
    route_pattern = url_path_join(
        web_app.settings["base_url"], proxy_root + ".*")
    web_app.add_handlers(host_pattern, [(route_pattern, SparkMonitorHandler)])


try:
    import lxml
except ImportError:
    BEAUTIFULSOUP_BUILDER = "html.parser"
else:
    BEAUTIFULSOUP_BUILDER = "lxml"
# a regular expression to match paths against the Spark on EMR proxy paths
PROXY_PATH_RE = re.compile(r"\/proxy\/application_\d+_\d+\/(.*)")
# a tuple of tuples with tag names and their attribute to automatically fix
PROXY_ATTRIBUTES = (
    (("a", "link"), "href"),
    (("img", "script"), "src"),
)


def replace(content, root_url):
    """Replace all the links with our prefixed handler links,

     e.g.:
    /proxy/application_1467283586194_0015/static/styles.css" or
    /static/styles.css
    with
    /spark/static/styles.css
    """
    soup = BeautifulSoup(content, BEAUTIFULSOUP_BUILDER)
    for tags, attribute in PROXY_ATTRIBUTES:
        for tag in soup.find_all(tags, **{attribute: True}):
            value = tag[attribute]
            match = PROXY_PATH_RE.match(value)
            if match is not None:
                value = match.groups()[0]
            tag[attribute] = url_path_join(root_url, value)
    return str(soup)


def url_path_join(*pieces):
    """Join components of url into a relative url

    Use to prevent double slash when joining subpath. This will leave the
    initial and final / in place
    """
    initial = pieces[0].startswith("/")
    final = pieces[-1].endswith("/")
    stripped = [s.strip("/") for s in pieces]
    result = "/".join(s for s in stripped if s)
    if initial:
        result = "/" + result
    if final:
        result = result + "/"
    if result == "//":
        result = "/"
    return result
