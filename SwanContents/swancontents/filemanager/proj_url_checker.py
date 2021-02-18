# Author: Danilo Piparo 2016
# Copyright CERN

"""Check the project url"""

import re
import requests
import string
from urllib import parse

from tornado import web

CERNBoxPrefix = 'https://cernbox.cern.ch/index.php/s'
CERNBoxPrefixTesting = 'https://cernboxwebpreview.cern.ch/index.php/s'
EOSUserPrefix = 'file://eos/'
LocalPrefix = 'local:'
EOSUserRE = '/eos/(docker/|up2u/)?(user/[a-z]|home-[a-z])/([a-z0-9]+)'
GitlabRE = '^https://(.+:.+@)?gitlab\.cern\.ch'

def get_name_from_shared_from_link(r):
    hdr = r.raw.getheader('Content-Disposition')
    encodedName = re.search('filename="(.*)"$',hdr).group(1)
    finalFilename = parse.unquote_plus(encodedName)
    return finalFilename

def is_cernbox_shared_link(proj_name):
    return (proj_name.startswith(CERNBoxPrefix) or proj_name.startswith(CERNBoxPrefixTesting)) and 'download' in proj_name

def is_good_proj_name(proj_name):
    if proj_name.endswith('.git') or proj_name.endswith('.ipynb') or proj_name.endswith('.zip'):
        return True
    if is_cernbox_shared_link(proj_name):
        return True
    return False

def is_file_on_eos(proj_name):
    return proj_name.startswith(EOSUserPrefix)

def get_eos_username(eos_path):
    try:
        return re.search(EOSUserRE, eos_path).group(3)
    except AttributeError:
        return None

def get_path_without_eos_base(eos_path):
    try:
        return re.compile(EOSUserRE).split(eos_path)[-1]
    except AttributeError:
        return ""

def has_good_chars(name, extra_chars=''):
    '''Check if contains only good characters.
    Avoid code injection: paranoia mode'''
    allowed = string.ascii_lowercase +\
              string.ascii_uppercase +\
              string.digits +\
              '/._+-' + extra_chars

    isFile=False
    if name.startswith('https:'):
        name = name[6:]

    if is_file_on_eos(name):
        name = name[5:]

    has_allowd_chars = set(name) <= set(allowed)
    if not has_allowd_chars: return False

    forbidden_seqs = ['&&', '|', ';', ' ', '..', '@']
    is_valid_url = any(i in name for i in forbidden_seqs)
    if not forbidden_seqs: return False

    return True

def check_url(url):

    url = parse.unquote(url)
    gitlab_match = re.compile(GitlabRE).match(url)

    # Limit the sources
    is_good_server = gitlab_match or \
                     url.startswith('https://github.com') or \
                     url.startswith('https://raw.githubusercontent.com') or \
                     url.startswith('https://root.cern.ch') or \
                     url.startswith('https://root.cern') or \
                     url.startswith('https://swan-gallery.web.cern.ch') or \
                     url.startswith(CERNBoxPrefix) or \
                     url.startswith(CERNBoxPrefixTesting) or \
                     url.startswith(EOSUserPrefix) or \
                     url.startswith(LocalPrefix)
    if not is_good_server:
        raise web.HTTPError(400, 'The URL of the project is not a github, CERN gitlab, CERNBox shared link nor root.cern.ch URL. It is not a path on EOS either.')

    # Check the chars
    onEOS = is_file_on_eos(url)
    local = url.startswith(LocalPrefix)
    cernbox = url.startswith(CERNBoxPrefix) or url.startswith(CERNBoxPrefixTesting)

    extra_chars = ""
    if cernbox:
        extra_chars = "?="
    if onEOS:
        extra_chars = " ()"
    if local:
        extra_chars = " ():"
    if gitlab_match:
        extra_chars = ":@"
    has_allowed_chars = has_good_chars(url, extra_chars)
    if not has_allowed_chars:
        raise web.HTTPError(400, 'The URL of the project is invalid (some of its characters are not accepted).')

    # Limit the kind of project
    is_good_ext = is_good_proj_name(url)
    if not local and not is_good_ext:
        raise web.HTTPError(400, 'The project must be a notebook or a git repository.')

    # Check it exists
    if not onEOS and not local:
        request = requests.get(url, verify=not is_cernbox_shared_link(url))
        sc = request.status_code
        if sc != 200:
            raise web.HTTPError(400, 'The URL of the project does not exist or is not reachable (status code is %s)' %sc)

    return True
