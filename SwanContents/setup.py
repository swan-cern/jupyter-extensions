#!/usr/bin/env python

from setuptools import setup, find_packages

setup(name='swancontents',
      version='0.0.1',
      description='Jupyter Notebook filesystem with Projects',
      include_package_data=True,
      packages=find_packages(),
      zip_safe=False,
      install_requires=[
          'notebook==5.0.0',
          'tornado',
          'jupyterhub==0.7.2',
          'jupyter_core'
      ],
  )