# SwanContents

Server and NB extension that provides:
* SWAN Projects (including readme preview)
* EOS integration (versioning and atomic save)
* git download
* SWAN style in a form of Jupyter Notebook templates

## Requirements

Besides Jupyter, this extension requires that the user home is set inside EOS.

## Install

Install the package and the nbextension:

```bash
pip install swancontents
jupyter nbextension install --user --py swancontents
```

Do not enable the nbextension, this will be done bellow.

To replace the default Jupyter Contents Manager (including its Javascript library) and the templates, in the Jupyter Notebook configuration (i.e in `jupyter_notebook_config.py`), set the following:

```python
c.ServerApp.contents_manager_class = 'swancontents.filemanager.SwanEosFileManager'
```

Note: `EOSCheckpoints` is set by default as `checkpoints_class` when using SwanEosFileManager.


