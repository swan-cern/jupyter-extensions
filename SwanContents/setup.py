"""
Setup Module for the SwanContents extension.
"""
import os

from jupyter_packaging import create_cmdclass, get_version
import setuptools

name = "swancontents"

version = get_version(os.path.join(name, "_version.py"))

HERE = os.path.abspath(os.path.dirname(__file__))

data_files_spec = [
    (
        "etc/jupyter/jupyter_server_config.d",
        "jupyter_server_config.d",
        "swancontents.json",
    ),
]

cmdclass = create_cmdclass(data_files_spec=data_files_spec)

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
