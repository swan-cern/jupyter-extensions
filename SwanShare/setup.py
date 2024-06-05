"""
Setup Module to setup Python Handlers for the SwanNotifications extension.
"""
import os

from jupyter_packaging import (
    create_cmdclass, install_npm, ensure_targets,
    combine_commands, get_version,
)
import setuptools

name="swanshare"

HERE = os.path.abspath(os.path.dirname(__file__))

# Get our version
version = get_version(os.path.join(name, "_version.py"))

nb_path = os.path.join(HERE, name, "nbextension")

# Representative files that should exist after a successful build
jstargets = [
    os.path.join(nb_path, "extension.js"),
]

package_data_spec = {
    name: [
        "*"
    ]
}

cmdclass = create_cmdclass("jsdeps", 
    package_data_spec=package_data_spec,
    data_files_spec=[(
        "etc/jupyter/jupyter_server_config.d",
        "jupyter_server_config.d",
        "swanshare.json",
    )]
)

cmdclass["jsdeps"] = combine_commands(
    install_npm(HERE, build_cmd="webpack"),
    ensure_targets(jstargets),
)

with open("README.md", "r") as fh:
    long_description = fh.read()

setup_args = dict(
    name=name,
    version=version,
    url="https://github.com/swan-cern/jupyter-extensions",
    author="SWAN Admins",
    description="Sharing for SWAN",
    long_description=long_description,
    long_description_content_type="text/markdown",
    cmdclass=cmdclass,
    packages=setuptools.find_packages(),
    install_requires=[
        'PyJWT'
    ],
    zip_safe=False,
    include_package_data=True,
    license="AGPL-3.0",
    platforms="Linux, Mac OS X, Windows",
    keywords=["Jupyter", "SWAN", "CERN"],
    classifiers=[
        "License :: OSI Approved :: GNU Affero General Public License v3",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Framework :: Jupyter",
    ],
)


if __name__ == "__main__":
    setuptools.setup(**setup_args)
