#!/usr/bin/env python

from setuptools import setup, find_packages

setup(name='sparkconnector',
      version='0.0.1',
      description='Helper to connect to CERN\'s Spark Clusters',
      include_package_data=True,
      packages=find_packages(),
      zip_safe=False,
      install_requires=[
          'notebook',
          'pyspark'
      ],
  )
