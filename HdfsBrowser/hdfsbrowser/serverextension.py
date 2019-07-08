#!/usr/bin/python
# -*- coding: utf-8 -*-

"""
    HdfsBrowser Jupyter Web Server Extension
    This module adds a custom request handler to Jupyter web server.
    It proxies the HDFS Browser by default running at $HDFS_NAMENODE_HOST:$HDFS_NAMENODE_PORT
    to the endpoint notebook_base_url/hdfsbrowser
"""

from notebook.base.handlers import IPythonHandler
import tornado.web
from tornado import httpclient
import os
import json
from urllib.request import urlopen
import re
import logging
from traitlets.config import LoggingConfigurable
from traitlets.traitlets import Unicode
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET

proxy_root = '/hdfsbrowser'


class HdfsBrowserHandler(IPythonHandler):
    """A custom tornado request handler to proxy HDFS Browser requests."""

    # httpclient.AsyncHTTPClient.configure('tornado.curl_httpclient.CurlAsyncHTTPClient')
    http = httpclient.AsyncHTTPClient()

    def set_default_headers(self):

        # Expose credentials (cookies, authorization headers) on the response

        self.set_header('Access-Control-Allow-Credentials', 'true')

    def get_active_namenode(self):

        # Determine the active namenode, this is required as the webHDFS implementation doesn't redirect to active namenode

        cluster = os.environ['SPARK_CLUSTER_NAME']
        conf = '/cvmfs/sft.cern.ch/lcg/etc/hadoop-confext/conf/etc/' + cluster + '/hadoop.' \
            + cluster + '/hdfs-site.xml'
        if cluster == 'hadoop-qa':
            property = 'dfs.ha.namenodes.hdpqa'
        elif cluster == 'hadoop-nxcals':
            property = 'dfs.ha.namenodes.nxcals'
        elif cluster == 'analytix':
            property = 'dfs.ha.namenodes.analytix'
        else:
            property = 'dfs.ha.namenodes.' + cluster
        tree = ET.parse(conf)
        root = tree.getroot()
        for elem in root.iter('property'):
            if elem[0].text == property:
                namenodes = elem[1].text
                break

        for namenode in namenodes.split(','):
            log.info("NameNode is :" + namenode)
            if json.loads(urlopen('http://' + namenode
                                  + ':50070/jmx?get=Hadoop:service=NameNode,name=NameNodeStatus::State'
                                  ).read())['beans'][0]['State'] == 'active':
                return namenode

    @tornado.web.asynchronous
    def get(self):
        """
            Handles get requests to the HDFS Browser
            Fetches the webHDFS from the configured ports
        """

        # Without protocol and trailing slash
        # baseurl = os.environ.get("HDFS_NAMENODE_HOST", "p01001532067275.cern.ch")

        baseurl = os.environ.get('HDFS_NAMENODE_HOST',
                                 self.get_active_namenode())
        port = os.environ.get('HDFS_NAMENODE_PORT', '50070')
        url = 'http://' + baseurl + ':' + port

        self.request_path = \
            self.request.uri[self.request.uri.index(proxy_root)
                             + len(proxy_root) + 1:]

        self.replace_path = \
            self.request.uri[:self.request.uri.index(proxy_root)
                             + len(proxy_root)]

        self.fetch_content(url_path_join(url, self.request_path))

    def fetch_content(self, url):

        # Fetches the requested content Enable SPENGO - HTTP based cross platform authentication for Kerberos
        # prepare_curl_callback = lambda x: x.setopt(pycurl.HTTPAUTH,
        #         pycurl.HTTPAUTH_GSSNEGOTIATE)
        # self.http.fetch(url, self.handle_response,
        #                 prepare_curl_callback=prepare_curl_callback,
        #                 auth_username=':')
        self.http.fetch(url, self.handle_response)

    def handle_response(self, response):
        """Sends the fetched page as response to the GET request"""

        if response.error:
            content_type = 'application/json'
            content = json.dumps({'error': 'HDFS Browser not reachable',
                                  'backendurl': response.effective_url,
                                  'replace_path': self.replace_path})
        else:
            content_type = response.headers['Content-Type']
            if 'text/html' in content_type:
                content = replace(response.body, self.replace_path)
            elif 'javascript' in content_type:
                content = response.body.decode().replace('/webhdfs/v1',
                                                         self.replace_path + '/webhdfs/v1')
                token = 'delegation=' + os.environ.get("WEBHDFS_TOKEN")
                content = content.replace('?op=', '?' + token.strip() + '&op=')

            else:
                content = response.body
        self.set_header('Content-Type', content_type)
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
    log = logging.getLogger('tornado.hdfsbrowser.server')
    log.name = 'hdfsBrowser'
    log.setLevel(logging.INFO)
    log.propagate = True
    log.info("Starting HdfsBrowser Kernel Extension")

    web_app = nb_server_app.web_app
    host_pattern = '.*$'
    route_pattern = url_path_join(web_app.settings['base_url'],
                                  proxy_root + '.*')
    web_app.add_handlers(host_pattern, [(route_pattern,
                                         HdfsBrowserHandler)])


try:
    import lxml
except ImportError:
    BEAUTIFULSOUP_BUILDER = 'html.parser'
else:
    BEAUTIFULSOUP_BUILDER = 'lxml'

# a regular expression to match paths against the Spark on EMR proxy paths

PROXY_PATH_RE = re.compile(r"(.*)")

# a tuple of tuples with tag names and their attribute to automatically fix

PROXY_ATTRIBUTES = ((('a', 'link'), 'href'), (('img', 'script'), 'src'))


def replace(content, root_url):
    """
        Replace all the links with our prefixed handler links,
        e.g.:
            /explorer.html or
            /static/hadoop.css
            with
            /hdfsbrowser/explorer.html
    """

    soup = BeautifulSoup(content, BEAUTIFULSOUP_BUILDER)
    soup.header.decompose()
    for (tags, attribute) in PROXY_ATTRIBUTES:
        for tag in soup.find_all(tags, **{attribute: True}):
            tag_old = tag
            value = tag[attribute]
            match = PROXY_PATH_RE.match(value)
            if match is not None:
                value = match.groups()[0]
            tag[attribute] = url_path_join(root_url, value)

            # log.debug("REPLACE: tag_attribute_old: %s tag_attribute_new: %s", value, tag[attribute])

    return str(soup)


def url_path_join(*pieces):
    """
        Join components of url into a relative url
        Use to prevent double slash when joining subpath. This will leave the
        initial and final / in place
    """

    initial = pieces[0].startswith('/')
    final = pieces[-1].endswith('/')
    stripped = [s.strip('/') for s in pieces]
    result = '/'.join(s for s in stripped if s)
    if initial:
        result = '/' + result
    if final:
        result = result + '/'
    if result == '//':
        result = '/'
    return result
