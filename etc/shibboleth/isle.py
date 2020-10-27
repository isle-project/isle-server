#!/usr/bin/python

# isle.py -- CGI Script to process ISLE welcome request and redirect to site
#
# Used with SSO via Shibboleth on Apache

from __future__ import print_function
from base64 import urlsafe_b64encode
import base64
import cgi
import cgitb
import hashlib
import os
import time

cgitb.enable()

SALT_LENGTH = 4
RESOURCE_DIR = './'
REDIRECT_TARGET = 'https://isle.stat.cmu.edu/#/shibboleth'


def read_secret():
    with open(RESOURCE_DIR + 'adata', 'r') as f:
        secret = f.read()
    return secret.strip()


def extract_saml_attrs(env):
    return {'eppn': os.environ['HTTP_EPPN'],
            'displayName': os.environ['HTTP_DISPLAYNAME'],
            'affiliation': os.environ['HTTP_AFFILIATION'],
            'url': os.environ.get('QUERY_STRING', ''), }


def add_instance_attrs(attrs):
    "Returns attribute map with time and salt added."
    attrs['time'] = "{:f}".format(time.time())
    attrs['salt'] = os.urandom(SALT_LENGTH).encode('hex')
    return attrs


def add_token(attrs):
    "Returns attribute map with combined and hashed token added."
    pattern = "{time} :: {salt} :: {secret} :: {eppn} :: {displayName} :: {affiliation} :: ISLE ROCKS!"
    secret = read_secret()
    token = pattern.format(secret=secret, **attrs)

    sha = hashlib.sha256()
    sha.update(token)
    attrs['token'] = sha.digest().encode('hex')

    return attrs


def encode_attributes(attrs):
    "Return updated attribute map with fields url-safe encode"
    attrs['eppn'] = urlsafe_b64encode(attrs['eppn'])
    attrs['displayName'] = urlsafe_b64encode(attrs['displayName'])
    attrs['affiliation'] = urlsafe_b64encode(attrs['affiliation'])
    attrs['url'] = urlsafe_b64encode(attrs['url'])
    attrs['salt'] = attrs['salt']
    attrs['token'] = attrs['token']

    return attrs


def query_string(attrs):
    q = "token={token}&time={time}&salt={salt}&eppn={eppn}&name={displayName}&affil={affiliation}&url={url}"
    return q.format(**attrs)


def diagnostic_output(attrs, target_url, env=os.environ):
    "Outputs HTML page showing information for diagnostic purposes."
    print("Content-type: text/html\r\n")
    print("<html>\n  <body>")
    print("<h1>SSO Attributes for request {} </h1>".format(attrs['url']))
    print("EPPN         {}".format(base64.urlsafe_b64decode(attrs['eppn'])))
    print("<br/>")
    print("Display Name {}".format(base64.urlsafe_b64decode(attrs['displayName'])))
    print("<br/>")
    print("Affiliation  {}".format(base64.urlsafe_b64decode(attrs['affiliation'])))
    print("<br/>")
    print("Redirect to: {}".format(target_url))
    print("<br/>")
    print("Token        {}".format(attrs['token']))
    print("<br/>")
    print("Directory    {}".format(os.getcwd()))
    print("<br/>")
    print("Diagnostic completed!")
    print("  </body>\n</html>")


def redirected_output(attrs, target_url):
    "Issues Redirect response to `target_url`."
    print("Location: {}\r\n".format(target_url))


saml_attrs = extract_saml_attrs(os.environ)
req_attrs = add_instance_attrs(saml_attrs)
request_data = encode_attributes(add_token(req_attrs))
redirect_url = REDIRECT_TARGET + "?" + query_string(request_data)

redirected_output(request_data, redirect_url)
