# SwanProjects

Server and Lab extension that provides:

- A jupyter serverextension with handlers to:
  - Create custom environments for folders with software stack defined in CVMFS
  - Get folder enviornment information
  - Get software stack information

- A frontend Jupyterlab extension with a forked version of @jupyterlab/launcher that shows a button to edit folder environments

- A kernel provisioner that dynamically customizes the enviornment of a kernel from metadata files in a folder. 

## Requirements

JupyterLab~=3.0

## Install & Configure

- Install the package with pip
- Configure `SWAN_DEFAULT_ENV_FILE` for the default environment for folders without an environment
- Configure `c.SwanProjectsConfig,stacks_path` in you jupyter server configuration to configuration of available software stacks

