# SparkConnector

Helper to connect to CERN's Spark Clusters

This extension is built as a Python module named `sparkconnector`, which simplifies the connection to Spark clusters.

It installs:

1. an nbclassic-extension
1. a Jupyterlab extension
1. an iPython extension


## Requirements

- JupyterLab >= 4.0.0
- pyspark (not installed by default)

## Install

To install the extension, execute:

```bash
pip install sparkconnector
jupyter nbclassic-extension install sparkconnector --py
jupyter nbclassic-extension enable  sparkconnector --py
```

It is also necessary to enable the iPython code. Append the following code to the config file (usually in `~/.ipython/profile_default/ipython_kernel_config.py`, check [here](https://ipython.readthedocs.io/en/stable/config/intro.html#python-configuration-files)):

```bash
c.InteractiveShellApp.extensions.append('sparkconnector.connector')
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall sparkconnector
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the sparkconnector directory
# Install package in development mode
pip install -e "."
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
jlpm build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
pip uninstall sparkconnector
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `@swan-cern/sparkconnector` within that folder.

### Packaging the extension

See [RELEASE](RELEASE.md)
