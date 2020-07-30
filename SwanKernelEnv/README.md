# SwanKernelEnv

Ipython kernel extension to remove SWAN extra configurations from the user environment. 


## Requirements

* ipykernel

## Install

```bash
pip install swankernelenv
```

## Usage

Set the following in `ipython_kernel_config.py`:

```python
c.InteractiveShellApp.extensions.append('swankernelenv')
```