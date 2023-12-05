# SwanContents

Server and NB extension that provides:
* SWAN Projects (including readme preview)
* EOS integration (versioning and atomic save)
* git download
* SWAN style in a form of Jupyter Notebook templates

This module also installs a lab extension that adds links throughout the UI to switch between the Lab and the old UI.

## Requirements

Besides Jupyter, this extension requires that the user home is set inside EOS.

## Install

Install the package and the nbextension:

```bash
pip install swancontents
```

To replace the default Jupyter Contents Manager (including its Javascript library) and the templates, in the Jupyter Notebook configuration (i.e in `jupyter_notebook_config.py`), set the following:

```python
c.ServerApp.contents_manager_class = 'swancontents.filemanager.SwanEosFileManager'
```

Note: `EOSCheckpoints` is set by default as `checkpoints_class` when using SwanEosFileManager.


