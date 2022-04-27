import os

import setuptools
from jupyter_packaging import get_version

name = "swandask"

# Get our version
version = get_version(os.path.join(name, "_version.py"))

with open("README.md", "r") as fh:
    long_description = fh.read()

setup_args = dict(
    name=name,
    version=version,
    url="https://github.com/swan-cern/jupyter-extensions",
    author="SWAN Admins",
    description="Wrapper to run dask_jupyterlab as an external process",
    long_description=long_description,
    long_description_content_type="text/markdown",
    data_files=[
        (
            "etc/jupyter/jupyter_server_config.d",
            ["jupyter-config/jupyter_server_config.d/dask_labextension.json"],
        ),
        (
            "etc/jupyter/jupyter_notebook_config.d",
            ["jupyter-config/jupyter_notebook_config.d/dask_labextension.json"],
        ),
    ],
    packages=setuptools.find_packages(),
    install_requires=["jupyter-server-proxy", "tornado"],  # "dask_labextension"
    zip_safe=False,
    include_package_data=True,
    license="AGPL-3.0",
    platforms="Linux, Mac OS X",
    keywords=["JupyterLab", "SWAN", "CERN"],
    entry_points={
        "console_scripts": [
            "swandask = swandask.app:main",
        ],
        "jupyter_serverproxy_servers": [
            "dask = swandask:setup_proxy",
        ],
    },
    classifiers=[
        "License :: OSI Approved :: GNU Affero General Public License v3",
        "Intended Audience :: Developers",
        "Intended Audience :: System Administrators",
        "Intended Audience :: Science/Research",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3",
    ],
)


if __name__ == "__main__":
    setuptools.setup(**setup_args)
