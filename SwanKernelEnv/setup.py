#!/usr/bin/env python

from setuptools import setup, find_packages

setup(name='swankernelenv',
      version='0.0.1',
      description='Kernel extension to manipulate the Python path of the user',
      include_package_data=True,
      packages=find_packages(),
      zip_safe=False,
      install_requires=[
          'notebook'
      ],
  )
