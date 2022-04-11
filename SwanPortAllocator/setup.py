"""
Setup Module to setup Python Handlers for the SwanPortAllocator extension.
"""
import os

from jupyter_packaging import get_version
import setuptools

name="swanportallocator"

# Get our version
version = get_version(os.path.join(name, "_version.py"))

data_files_spec = [
    ("etc/jupyter/jupyter_server_config.d",
     "jupyter-config/jupyter_server_config.d", "swanportallocator.json"),
    ("etc/jupyter/jupyter_notebook_config.d",
     "jupyter-config/jupyter_notebook_config.d", "swanportallocator.json"),
]

with open("README.md", "r") as fh:
    long_description = fh.read()

setup_args = dict(
    name=name,
    version=version,
    url="https://github.com/swan-cern/jupyter-extensions",
    author="SWAN Admins",
    description="Extension that provides a port allocation mechanism to other SWAN components",
    long_description= long_description,
    long_description_content_type="text/markdown",
    packages=setuptools.find_packages(),
    install_requires=[
        'pyzmq',
    ],
    zip_safe=False,
    include_package_data=True,
    python_requires=">=3.6",
    license="AGPL-3.0",
    platforms="Linux, Mac OS X, Windows",
    keywords=["Jupyter", "Notebooks", "SWAN", "CERN"],
    classifiers=[
        "License :: OSI Approved :: GNU Affero General Public License v3",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Framework :: Jupyter",
    ],
)


if __name__ == "__main__":
    setuptools.setup(**setup_args)
