#!/usr/bin/env python

from setuptools import setup, find_packages

setup(name='swangallery',
      version='0.0.1',
      description='Examples gallery for SWAN',
      author='Diogo Castro',
      author_email='diogo.castro@cern.ch',
      include_package_data=True,
      packages=find_packages(),
      zip_safe=False,
      install_requires=[
          'notebook',
          'swannotebookviewer'
      ],
  )
