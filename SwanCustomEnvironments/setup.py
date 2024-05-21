from setuptools import setup, find_packages

setup(
    packages=find_packages(),
    include_package_data=True,
    package_data={
        'swancustomenvironments': ['templates/*', 'scripts/*'],
    }   
)