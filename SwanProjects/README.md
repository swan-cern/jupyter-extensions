# SwanProjects

Server and Lab extension that provides:
* In the backend, the endpoints to:
  * Create and edit projects
  * Get project information
  * Get software stack information
  * A customized Kernel Spec Manager to handle kernel metadata
* In the Lab extension:
  * React dialogs to create and edit projects
  * LabIcons required for the dialogs

## Requirements

JupyterLab~=3.0 and SwanContents

## Install

Install the package and the lab extension:

```bash
pip install swanprojects
```

To replace the default Jupyter Contents Manager and Kernel Spec Manager in the JupyterLab Notebook configuration (i.e in `jupyter_notebook_config.py`), set the following:

```python
c.NotebookApp.default_url = 'lab'
c.NotebookApp.contents_manager_class = 'swancontents.filemanager.swanfilemanager.SwanFileManager'
c.NotebookApp.kernel_spec_manager_class = 'swanprojects.kernelmanager.kernelspecmanager.SwanKernelSpecManager'
c.KernelSpecManager.ensure_native_kernel = False

c.SwanProjects.stacks_path=path_to_stacks.json
c.SwanKSMConfig.kernel_resources=path_to_native_kernel_resources
```
