"""
Setup Module to setup Python Handlers for the HdfsBrowser extension.
"""
import json
import os

from jupyter_packaging import (
    create_cmdclass, install_npm, ensure_targets,
    combine_commands, skip_if_exists
)
import setuptools

name="hdfsbrowser"

HERE = os.path.abspath(os.path.dirname(__file__))

# Get our version
with open(os.path.join(HERE, 'package.json')) as f:
    version = json.load(f)['version']

lab_path = os.path.join(HERE, name, "labextension")
nb_path = os.path.join(HERE, name, "nbextension")

# Representative files that should exist after a successful build
jstargets = [
    os.path.join(lab_path, "package.json"),
    os.path.join(nb_path, "extension.js"),
]

package_data_spec = {
    name: [
        "*"
    ]
}

labext_name = "@swan-cern/hdfsbrowser"

data_files_spec = [
    ("share/jupyter/labextensions/%s" % labext_name, lab_path, "**"),
    ("etc/jupyter/jupyter_server_config.d",
     "jupyter-config/jupyter_server_config.d", "hdfsbrowser.json"),
     ("etc/jupyter/jupyter_notebook_config.d",
     "jupyter-config/jupyter_notebook_config.d", "hdfsbrowser.json"),
]

cmdclass = create_cmdclass("jsdeps",
    package_data_spec=package_data_spec,
    data_files_spec=data_files_spec
)

js_command = combine_commands(
    install_npm(HERE, build_cmd="install:all", npm=["jlpm"]),
    install_npm(HERE, build_cmd="build:prod", npm=["jlpm"]),
    ensure_targets(jstargets),
)

is_repo = os.path.exists(os.path.join(HERE, ".git"))
if is_repo:
    cmdclass["jsdeps"] = js_command
else:
    cmdclass["jsdeps"] = skip_if_exists(jstargets, js_command)

with open("README.md", "r") as fh:
    long_description = fh.read()

setup_args = dict(
    name=name,
    version=version,
    url="https://github.com/swan-cern/jupyter-extensions",
    author="SWAN Admins",
    description="Jupyter Server extension to browse HDFS filesystem",
    long_description= long_description,
    long_description_content_type="text/markdown",
    cmdclass= cmdclass,
    packages=setuptools.find_packages(),
    install_requires=[
        "jupyterlab>=4.0.0,<5",
        "bs4",
    ],
    zip_safe=False,
    include_package_data=True,
    python_requires=">=3.6",
    license="AGPL-3.0",
    platforms="Linux",
    keywords=["Jupyter", "JupyterLab", "SWAN", "CERN"],
    classifiers=[
        "Framework :: Jupyter",
        "Framework :: Jupyter :: JupyterLab",
        "Framework :: Jupyter :: JupyterLab :: 4",
        "Framework :: Jupyter :: JupyterLab :: Extensions",
        "Framework :: Jupyter :: JupyterLab :: Extensions :: Prebuilt",
        "License :: OSI Approved :: GNU Affero General Public License v3",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
)


if __name__ == "__main__":
    setuptools.setup(**setup_args)
