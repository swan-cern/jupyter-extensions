#!/usr/bin/env python

from setuptools import setup, find_packages

setup(name='swannotebookviewer',
      version='0.0.1',
      description='Extension that provides a Jupyter Notebook viewer as an endpoint',
      author='Diogo Castro',
      author_email='diogo.castro@cern.ch',
      include_package_data=True,
      packages=find_packages(),
      zip_safe=False,
      install_requires=[
          'notebook',
          'nbconvert',
          'nbformat'
      ],
)
