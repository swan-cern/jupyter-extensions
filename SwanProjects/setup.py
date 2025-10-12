"""
swanprojects setup
"""
import json
from pathlib import Path

import setuptools

HERE = Path(__file__).parent.resolve()

# The name of the project
name = "swanprojects"

lab_path = (HERE / name / "labextensions")

# Representative files that should exist after a successful build
ensured_targets = [
    # str(lab_path / "package.json"), TODO
    # str(lab_path / "static/style.js")
]


data_files_spec = [
    ("share/jupyter/labextensions/@swan/filebrowser-extension", "swanprojects/labextensions/@swan/filebrowser-extension", "**"),
    ("share/jupyter/labextensions/@swan/projects-extension", "swanprojects/labextensions/@swan/projects-extension", "**"),
    ("share/jupyter/labextensions/@swan/launcher-extension", "swanprojects/labextensions/@swan/launcher-extension", "**"),
    ("share/jupyter/labextensions/@swan/terminal-extension", "swanprojects/labextensions/@swan/terminal-extension", "**"),
    ("etc/jupyter/jupyter_server_config.d", "jupyter-config/server-config", "swanprojects.json"),
    # For backward compatibility with notebook server
    ("etc/jupyter/jupyter_notebook_config.d", "jupyter-config/nb-config", "swanprojects.json")
]

long_description = (HERE / "README.md").read_text()

# Get the package info from package.json
pkg_json = json.loads((HERE / "package.json").read_bytes())

setup_args = dict(
    name=name,
    version=pkg_json["version"],
    url=pkg_json["homepage"],
    author=pkg_json["author"],
    description=pkg_json["description"],
    license=pkg_json["license"],
    long_description=long_description,
    long_description_content_type="text/markdown",
    scripts=['bin/swan_env', 'bin/swan_bash', 'bin/swan_kmspecs'],
    packages=setuptools.find_packages(),
    install_requires=[
        "jupyter_server>=1.6,<2"
    ],
    zip_safe=False,
    include_package_data=True,
    python_requires=">=3.6",
    platforms="Linux, Mac OS X, Windows",
    keywords=["Jupyter", "JupyterLab", "JupyterLab3"],
    classifiers=[
        "License :: OSI Approved :: GNU Affero General Public License v3",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Framework :: Jupyter",
    ],
)

try:
    from jupyter_packaging import (
        wrap_installers,
        npm_builder,
        get_data_files
    )
    post_develop = npm_builder(
        build_cmd="install:extension", source_dir="src", build_dir=lab_path
    )
    setup_args['cmdclass'] = wrap_installers(
        post_develop=post_develop, ensured_targets=ensured_targets)
    setup_args['data_files'] = get_data_files(data_files_spec)
except ImportError as e:
    print(e)

if __name__ == "__main__":
    setuptools.setup(**setup_args)
