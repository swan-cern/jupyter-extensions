"""
Setup Module to setup Python Handlers for the SwanKernelEnv extension.
"""
import os

from jupyter_packaging import (
    create_cmdclass, install_npm, ensure_targets,
    combine_commands, skip_if_exists, get_version
)
import setuptools

name = "swancontents"

# Get our version
version = get_version(os.path.join(name, "_version.py"))

HERE = os.path.abspath(os.path.dirname(__file__))
lab_path = os.path.join(HERE, name, "swanclassic/labextension")

# Representative files that should exist after a successful build
jstargets = [
    os.path.join(lab_path, "package.json"),
]

package_data_spec = {
    name: [
        "*"
    ]
}

labext_name = "@swanclassic/lab-extension"

data_files_spec = [
    ("share/jupyter/labextensions/%s" % labext_name, lab_path, "**"),
    ("share/jupyter/labextensions/%s" % labext_name, HERE, "install.json"),
    (
        "etc/jupyter/jupyter_server_config.d",
        "jupyter_server_config.d",
        "swancontents.json",
    ),
]

cmdclass = create_cmdclass("jsdeps",
    package_data_spec=package_data_spec,
    data_files_spec=data_files_spec
)

js_command = combine_commands(
    install_npm(HERE, npm=["jlpm"]),
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
    description="SWAN Contents Manager for Jupyter",
    long_description=long_description,
    long_description_content_type="text/markdown",
    cmdclass=cmdclass,
    packages=setuptools.find_packages(),
    install_requires=[
        "jupyter_server",
        "nbclassic",
    ],
    zip_safe=False,
    include_package_data=True,
    license="AGPL-3.0",
    platforms="Linux, Mac OS X, Windows",
    keywords=["Jupyter", "Notebooks", "SWAN", "CERN"],
    classifiers=[
        "License :: OSI Approved :: GNU Affero General Public License v3",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Framework :: Jupyter",
    ],
    python_requires=">=3.9",
    entry_points={
        "console_scripts": [
            "jupyter-swanclassic = swancontents.swanclassic.notebookapp:main",
        ]
    },
)


if __name__ == "__main__":
    setuptools.setup(**setup_args)
