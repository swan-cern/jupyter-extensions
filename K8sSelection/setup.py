#!/usr/bin/env python

import setuptools

setuptools.setup(
    name="k8sselection",
    version='0.0.1',
    author='Sahil Jajodia',
    description='Helper to switch between CERN\'s Spark Clusters',
    include_package_data=True,
    packages=setuptools.find_packages(),
    zip_safe=False,
    install_requires=[
          'notebook',
          'kubernetes==9.0.0'
      ],

)