# SwanShare

Jupyter extension to allow sharing integration between SWAN and CERNBox.

This extension is composed of a Python package named `swanshare`, which installs the nbextension.
It's not supposed to contain a JupyterLab because this functionality is being replaced by a different package.

## Install

```bash
pip install swanshare
jupyter nbclassic-extension install swanshare --py
jupyter nbclassic-extension enable swanshare --py
```
