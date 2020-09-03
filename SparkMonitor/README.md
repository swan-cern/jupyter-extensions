# SparkMonitor

SparkMonitor is an extension for Jupyter Notebook that enables the live monitoring of Apache Spark Jobs spawned from a notebook. The extension provides several features to monitor and debug a Spark job from within the notebook interface itself.

![jobdisplay](https://user-images.githubusercontent.com/6822941/29753710-ff8849b6-8b94-11e7-8f9c-bdc59bf72143.gif)

It was originally developed as part of Google Summer of Code by @krishnan-r. The original repo can be seen here: https://github.com/krishnan-r/sparkmonitor


This extension is composed of a Python package named `sparkmonitor`, which installs the nbextension, Kernel extension and a NPM package named `@swan-cern/sparkmonitor` for the JupyterLab extension.


## Requirements

* JupyterLab >= 2.0
* PySpark on [Apache Spark](https://spark.apache.org/) version 2.1.1 or higher
* [Jupyter Notebook](http://jupyter.org/) version 4.4.0 or higher
* SBT to compile the Scala listener

## Install

Note: You will need NodeJS to install the extension.

```bash
pip install sparkmonitor
jupyter nbextension install sparkmonitor --py
jupyter nbextension enable  sparkmonitor --py
jupyter serverextension enable --py --system sparkmonitor # this should happen automatically
jupyter lab build
```

To enable the Kernel extension, create the default profile configuration files (Skip if config file already exists) and configure the kernel to load the extension on startup. This is added to the configuration files in users home directory.
```bash
ipython profile create
echo "c.InteractiveShellApp.extensions.append('sparkmonitor.kernelextension')" >>  $(ipython profile locate default)/ipython_kernel_config.py
```

## Configuration
By default the Spark Web UI runs on `localhost:4040`. If this is not the case, setting the environment variable `SPARKMONITOR_UI_HOST` and `SPARKMONITOR_UI_PORT` overrides the default Spark UI hostname `localhost` and port 4040 used by the Spark UI proxy.


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
# Move to sparkmonitor directory

# Install server extension
# This will also build the js code
pip install -e .

# Install and enable the nbextension
jupyter nbextension install sparkmonitor --py --sys-prefix
jupyter nbextension enable  sparkmonitor --py --sys-prefix

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
pip uninstall sparkmonitor
jupyter labextension uninstall @swan-cern/sparkmonitor
```
