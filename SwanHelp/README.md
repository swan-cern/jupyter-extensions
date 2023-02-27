# SwanHelp

Help panel for SWAN

This extension adds the following to the 'Help' menu in the menubar
- About dialog 
- Links to Community Forum, and Support portal
- A help panel that opens an iframe to the documentation website
- An 'Examples Gallery' panel that opens the notebook gallery website inside an iframe. The extension 
  also allows downloading and opening notebooks in the gallery website directly inside the SWAN session.

This extension is composed of a Python package named `swanhelp`, which installs the nbextension and a NPM package named `@swan-cern/swanhelp`
for the JupyterLab extension.

## How the 'Examples Gallery' works

- The gallery panel allows browsing the SWAN Gallery website within an iframe and downloading notebooks into the 
SWAN session all from within the JupyterLab UI.

- On clicking download inside the iframe, javascript inside the iframe sends a message using `window.postMessage()` to the 
parent JupyterLab window.

- The JupyterLab extension handles this message and makes a request to the SwanContents API (`/user/api/contents/download`) with the URL 
of the notebook to download.

- The jupyter server downloads the notebook and on success the notebook is opened by the extension in a new tab in JupyterLab 

## Requirements

* JupyterLab >= 3.0

## Install

```bash
pip install swanhelp
```

To enable the nbextension in the classic notebook ui:
```bash
jupyter nbextension install swanhelp --py
jupyter nbextension enable  swanhelp --py
```


## Troubleshoot

If you are seeing the frontend extension, but it is not working, check
that the server extension is enabled:

```bash
jupyter server extension list
```

If the server extension is installed and enabled, but you are not seeing
the frontend extension, check the frontend extension is installed:

```bash
jupyter labextension list
```


## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the swanhelp directory
# Install package in development mode
pip install -e .
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
jlpm run build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm run watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm run build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Uninstall

```bash
pip uninstall swanhelp
```
