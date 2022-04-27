# SwanDask

This module is a wrapper to the [dask-labextension](https://github.com/dask/dask-labextension) extension.
It allows running the backend as a separate process, served via jupyter-server-proxy, instead of a server extension.

We use it to configure the Dask environment, which we want to be different than the process running Jupyter Lab.

The extension will automatically load the environment from the default Python 3 kernel.


## Install

```
pip install swandask
```

~~If being served under an LCG release, install the package without any dependency except Jupyter and `jupyter-server-proxy`.~~ Installing without dependencies doesn't create the entry points. So the extension no longer depends on `dask-labextension` but this needs to be present. It also requires, and installs, tornado and `jupyter-server-proxy`.

This extension needs to be installed *after* its dependency `dask-labextension` in order to disable the server extension automatically. Otherwise, just disable it manually.
