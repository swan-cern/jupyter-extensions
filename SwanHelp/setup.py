"""
swanhelp setup
"""
import json
import os

from jupyter_packaging import (
    create_cmdclass, install_npm, ensure_targets,
    combine_commands, skip_if_exists
)
import setuptools

HERE = os.path.abspath(os.path.dirname(__file__))
NBEXTENSION = os.path.join(HERE, "nbextension")

# The name of the project
name="swanhelp"

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

labext_name = "@swan-cern/swanhelp"

data_files_spec = [
    ("share/jupyter/labextensions/%s" % labext_name, lab_path, "**"),
    ("share/jupyter/labextensions/%s" % labext_name, HERE, "install.json"),
     
]

cmdclass = create_cmdclass("jsdeps",
    package_data_spec=package_data_spec,
    data_files_spec=data_files_spec
)

js_command = combine_commands(
    install_npm(HERE, build_cmd="build:prod", npm=["jlpm"]),
    install_npm(NBEXTENSION, build_cmd="build", npm=["jlpm"]),
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
    url="https://github.com/swan-cern/jupyter-extensions.git",
    author="SWAN Admins",
    description="Help panel for SWAN",
    long_description= long_description,
    long_description_content_type="text/markdown",
    cmdclass= cmdclass,
    packages=setuptools.find_packages(),
    install_requires=[
        "jupyterlab>=3.0.0rc13,==3.*",
    ],
    zip_safe=False,
    include_package_data=True,
    python_requires=">=3.6",
    license="AGPL-3.0",
    platforms="Linux, Mac OS X, Windows",
    keywords=["Jupyter", "JupyterLab", "JupyterLab3", "SWAN", "CERN"],
    classifiers=[
        "License :: OSI Approved :: GNU Affero General Public License v3",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Framework :: Jupyter",
    ],
)


if __name__ == "__main__":
    setuptools.setup(**setup_args)
