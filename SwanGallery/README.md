# SwanGallery

SWAN Gallery is a service that provides the users with a set of notebooks and project examples to help the user use the service by opening them into its session and using them directly without any extra step.

The extension helps reducing the amount of time spent by the user on unnecessary hurdles thanks to its user friendly interface. Since, any user can scroll through the many notebook choices and download it directly to his session within a click. The notebook is then opened in a new tab inside the JupyterLab session allowing the user to freely switch between the many test notebooks and make different changes.

This extension is composed of a Python package named `SwanGallery` for the server extension and a NPM package named `SwanGallery` for the frontend extension. 

The front-end communicates with the static page hosted in an MkDocs server (MkDocs-Swan) that in its own communicates with the python server using `window.PostMessage` to prompt the specific file or folder link to download. The front-end uses the link received to send a request to the back-end, which depending on the link sent uses the download logic to dowload the file or folder inside the existing session. 

The front-end receives back a success message from the request and uses it to have JupyterLab open the created file/ folder to have a smooth interaction for the user.

- Notebook Gallery &rarr; JupyterLab Extension &rarr; SWAN Contents APi &rarr; SWAN Gallery API &rarr; Download

## Requirements

- JupyterLab >= 3.0

## Install

To install the extension, execute:

```bash
pip install SwanGallery
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall SwanGallery
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
# Change directory to the SwanGallery directory
# Install package in development mode
pip install -e .
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Server extension must be manually installed in develop mode
jupyter server extension enable SwanGallery
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
# Server extension must be manually disabled in develop mode
jupyter server extension disable SwanGallery
pip uninstall SwanGallery
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `SwanGallery` within that folder.

### Testing the extension

#### Server tests

This extension is using [Pytest](https://docs.pytest.org/) for Python code testing.

Install test dependencies (needed only once):

```sh
pip install -e ".[test]"
```

To execute them, run:

```sh
pytest -vv -r ap --cov SwanGallery
```

#### Frontend tests

This extension is using [Jest](https://jestjs.io/) for JavaScript code testing.

To execute them, execute:

```sh
jlpm
jlpm test
```

#### Integration tests

This extension uses [Playwright](https://playwright.dev/docs/intro/) for the integration tests (aka user level tests).
More precisely, the JupyterLab helper [Galata](https://github.com/jupyterlab/jupyterlab/tree/master/galata) is used to handle testing the extension in JupyterLab.

More information are provided within the [ui-tests](./ui-tests/README.md) README.

### Packaging the extension

See [RELEASE](RELEASE.md)
