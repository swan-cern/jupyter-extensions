# SwanPortAllocator

Extension that provides a port allocation mechanism to other SWAN components.

## Requirements

* pyzmq

## Install

```bash
pip install swanportallocator
```

## Usage

Configure the server extension to load when the notebook server starts

```bash
 jupyter serverextension enable --py --user swanportallocator
```

Class `swanportallocator.portallocator.PortAllocatorClient` can be used to connect to the port allocator process and get a given number of free ports.
