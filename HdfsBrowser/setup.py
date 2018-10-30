#!/usr/bin/env python

from setuptools import setup, find_packages

setup(name='hdfsbrowser',
      version='0.0.1',
      description='HDFS Browser Extension for Jupyter Notebook',
      author='Prasanth Kothuri',
      author_email='prasanth_kothuri@hotmail.com',
      url='https://github.com/prasanthkothuri/hdfsbrowser',
      include_package_data=True,
      packages=find_packages(),
      zip_safe=False,
      install_requires=[
          'bs4'
      ],
      )
