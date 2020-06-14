import json
import re
import os
import traceback

from traitlets import Unicode, Long, Float
from traitlets.config import Configurable

from notebook.utils import url_path_join
from notebook.base.handlers import IPythonHandler

from tornado import gen, web, httputil
from tornado.httpclient import AsyncHTTPClient, HTTPRequest

import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup


class HDFSBrowserConfig(Configurable):
    """
    Allows configuration of HDFS Browser, set defaults for server extenions
    """

    hdfs_site_path = Unicode(
        'test/hdfs-site.xml', config=True, help='Path to hdfs-site.xml'
    )

    hdfs_site_namenodes_property = Unicode(
        'dfs.ha.namenodes.test', config=True, help='Property of hdfs-site.xml pointing to namenode'
    )

    hdfs_site_namenodes_port = Unicode(
        '50070', config=True, help='Port of web hdfs on namenode'
    )

    webhdfs_token = Unicode(
        os.environ.get("WEBHDFS_TOKEN", ""), config=True, help='Token for webhdfs'
    )

    webhdfs_response_timeout = Float(
        3600, config=True, help='Do not respond to webhdfs requests longer than this value e.g. for download'
    )

    webhdfs_max_body_size = Long(
        10 * 1024 * 1024 * 1024, config=True, help='Do not download files larger than this value'
    )

    webhdfs_max_chunk_size = Long(
        10 * 1024 * 1024, config=True, help='Do not download file chunks larger than this value'
    )

    connection_timeout = Float(
        2, config=True, help='Do not wait for connection longer than this value'
    )


class HDFSBrowserProxy(IPythonHandler):

    hdfs_browser_config = None
    proxy_root = None
    active_namenode_url = None

    def initialize(self, proxy_root):
        self.hdfs_browser_config = HDFSBrowserConfig(config=self.config)
        self.proxy_root = proxy_root

    @gen.coroutine
    def prepare(self):
        """Determine the active namenode,
        this is required as the webHDFS implementation doesn't redirect to active namenode

        Note: this round-trip call for each request might be avoided with request cookies
        """

        # get namenodes list
        tree = ET.parse(self.hdfs_browser_config.hdfs_site_path)
        root = tree.getroot()
        namenodes = ""
        for elem in root.iter('property'):
            if elem[0].text == self.hdfs_browser_config.hdfs_site_namenodes_property:
                namenodes = elem[1].text
                break

        # get active namenode
        for namenode in namenodes.split(','):
            nmd_active_url = 'http://{0}:{1}/jmx?get=Hadoop:service=NameNode,name=NameNodeStatus::State'.format(
                namenode, self.hdfs_browser_config.hdfs_site_namenodes_port)

            try:
                response = yield AsyncHTTPClient().fetch(
                    HTTPRequest(nmd_active_url, connect_timeout=1),
                    raise_error=False
                )
            except Exception:
                self.log.error('NameNode request {0} failed, state could not be retrieved'.format(nmd_active_url))
                self.log.error(traceback.format_exc())
                break

            if response and response.body:
                namenode_state = json.loads(response.body)['beans'][0]['State']
                self.log.debug('NameNode {0} state is {1}'.format(namenode, namenode_state))

                if namenode_state == 'active':
                    self.active_namenode_url = 'http://{0}:{1}'.format(
                        namenode, self.hdfs_browser_config.hdfs_site_namenodes_port)
                    break
            else:
                self.log.error('NameNode request {0} responded with empty response').format(nmd_active_url)

    @gen.coroutine
    def get(self):
        """GET request handler

        # Fetches the requested content Enable SPENGO - HTTP based cross platform authentication for Kerberos
        # prepare_curl_callback = lambda x: x.setopt(pycurl.HTTPAUTH,
        #         pycurl.HTTPAUTH_GSSNEGOTIATE)
        # self.http.fetch(url, self.handle_response,
        #                 prepare_curl_callback=prepare_curl_callback,
        #                 auth_username=':')
        """

        # match everything that goes after proxy root %proxy_root%%request_path%
        # e.g. /hdfsbrowser/webhdfs/v1/?del=dummy -> proxy_root=/hdfsbrowser, request_path=/webhdfs/v1/?del=dummy
        request_path = \
            self.request.uri[self.request.uri.index(self.proxy_root)
                             + len(self.proxy_root) + 1:]
        self.log.debug('HDFSBrowserHandler handle request {}'.format(request_path))

        if not self.active_namenode_url:
            raise web.HTTPError(status_code=500, log_message='HDFS Browser not available, no active hdfs namenode')

        # proxy the request
        hdfs_browser_url = url_path_join(self.active_namenode_url, request_path)

        self.log.debug('HDFSBrowserHandler proxing request {}'.format(hdfs_browser_url))

        try:
            if '/webhdfs/v1' in hdfs_browser_url:
                yield AsyncHTTPClient(force_instance=True,
                                      max_body_size=self.hdfs_browser_config.webhdfs_max_body_size,
                                      max_buffer_size=self.hdfs_browser_config.webhdfs_max_chunk_size).fetch(
                    HTTPRequest(url=hdfs_browser_url,
                                header_callback=self.handle_webhdfs_stream_header,
                                streaming_callback=self.handle_webhdfs_stream_chunk,
                                request_timeout=self.hdfs_browser_config.webhdfs_response_timeout,
                                connect_timeout=self.hdfs_browser_config.connection_timeout),
                    raise_error=False
                )
                self.handle_webhdfs_stream_finish()
            else:
                # explorer requests need to be fully delivered to be parsed
                explorer_response = yield AsyncHTTPClient().fetch(
                    HTTPRequest(
                        url=hdfs_browser_url,
                        connect_timeout=self.hdfs_browser_config.connection_timeout)
                    ,
                    raise_error=False
                )
                self.handle_explorer_response(explorer_response)
        except Exception:
            self.log.error(traceback.format_exc())
            raise web.HTTPError(status_code=500, log_message='HDFS Browser request {0} failed'.format(hdfs_browser_url))

    def handle_explorer_response(self, response):
        content_type = response.headers['Content-Type']

        self.log.debug('HDFSBrowserHandler explorer {0} response content-type {1}'.format(
            self.request.uri, content_type))

        replace_path = self.request.uri[:self.request.uri.index(self.proxy_root) + len(self.proxy_root)]

        if 'text/html' in content_type:
            # a regular expression to match paths against the Spark on EMR proxy paths
            PROXY_PATH_RE = re.compile(r'(.*)')

            # a tuple of tuples with tag names and their attribute to automatically fix
            PROXY_ATTRIBUTES = ((('a', 'link'), 'href'), (('img', 'script'), 'src'))

            # prepend to each url a proxy root
            soup = BeautifulSoup(response.body, 'html.parser')
            soup.header.decompose()
            for (tags, attribute) in PROXY_ATTRIBUTES:
                for tag in soup.find_all(tags, **{attribute: True}):
                    value = tag[attribute]
                    match = PROXY_PATH_RE.match(value)
                    if match is not None:
                        value = match.groups()[0]
                    tag[attribute] = url_path_join(replace_path, value)
                    self.log.debug('REPLACE: tag_attribute_old: {0} tag_attribute_new: {1}'.format(
                        value, tag[attribute]))

            content = soup.prettify()
        elif 'javascript' in content_type:
            content = response.body.decode().replace(
                '/webhdfs/v1',
                url_path_join(replace_path, '/webhdfs/v1')
            )
            content = content.replace(
                '?op=',
                '?delegation={0}&op='.format(self.hdfs_browser_config.webhdfs_token.strip())
            )
        else:
            content = response.body

        self.set_status(response.code)
        self.set_header('Content-Type', content_type)
        self.write(content)
        self.finish()

    def handle_webhdfs_stream_header(self, header_line):
        """Handles the incoming first lines of the response being headers and status code
        """
        headers = httputil.HTTPHeaders()
        header_line = header_line.rstrip()

        if not header_line:
            return

        self.log.debug('HDFSBrowserHandler webhdfs {0} header'.format(header_line))

        if header_line.startswith('HTTP/'):
            try:
                status = httputil.parse_response_start_line(header_line)
                self.set_status(status.code)
                return
            except httputil.HTTPInputError:
                return

        headers.parse_line(header_line)

        # currently we are interested in propagating content-type and content-length
        if headers.get('Content-Type'):
            self.set_header('Content-Type', headers.get('Content-Type'))
        if headers.get('Content-Length'):
            self.set_header('Content-Length', headers.get('Content-Length'))

    def handle_webhdfs_stream_chunk(self, chunk):
        """Handles response chunk of the data by writing it onto the network
        """

        self.log.debug('HDFSBrowserHandler webhdfs {0} chunk'.format(self.request.uri))

        self.write(chunk)
        self.flush()

    def handle_webhdfs_stream_finish(self):
        """Handles finish of the response
        """
        self.log.debug('HDFSBrowserHandler webhdfs {0} finish'.format(self.request.uri))
        self.finish()

    def compute_etag(self):
        """Disable caching with etag
        """
        return None