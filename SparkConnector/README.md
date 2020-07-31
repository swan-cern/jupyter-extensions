# SparkConnector

Helper to connect to CERN's Spark Clusters

This extension is composed of a Python package named `sparkconnector`, which installs the nbextension and a NPM package named `@swan-cern/sparkconnector`
for the JupyterLab extension.


## Requirements

* JupyterLab >= 2.0

## Install

Note: You will need NodeJS to install the extension.

```bash
pip install sparkconnector
jupyter nbextension install sparkconnector --py
jupyter nbextension enable  sparkconnector --py
jupyter lab build
```

## Troubleshoot

If you are not seeing the frontend, check if it's installed:

```bash
jupyter labextension list
```

If it is installed, try:

```bash
jupyter lab clean
jupyter lab build
```

## Contributing

### Install

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Move to sparkconnector directory

# Install server extension
# This will also build the js code
pip install -e .

# Install and enable the nbextension
jupyter nbextension install sparkconnector --py --sys-prefix
jupyter nbextension enable  sparkconnector --py --sys-prefix

# Link your development version of the extension with JupyterLab
jupyter labextension link .
# Rebuild JupyterLab after making any changes
jupyter lab build

# Rebuild Typescript source after making changes
jlpm build
# Rebuild JupyterLab after making any changes
jupyter lab build
```

You can watch the source directory and run JupyterLab in watch mode to watch for changes in the extension's source and automatically rebuild the extension and application.

```bash
# Watch the source directory in another terminal tab
jlpm watch
# Run jupyterlab in watch mode in one terminal tab
jupyter lab --watch
```

### Uninstall

```bash
pip uninstall sparkconnector
jupyter labextension uninstall @swan-cern/sparkconnector
```
