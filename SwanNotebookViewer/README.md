# SwanNotebookViewer

Extension that provides a Jupyter Notebook viewer as an endpoint

## Requirements

* notebook
* nbconvert
* nbformat

## Install

```bash
pip install swannotebookviewer
```

This extension requires a template file `notebook_view.html`, just like the one available in the SwanJupyterTemplates module.

## Usage

Configure the server extension to load when the notebook server starts

```bash
 jupyter serverextension enable --py --user swannotebookviewer
```

Notebooks opened in Jupyter have the following type of url: `http://localhost:8888/notebooks/Untitled.ipynb`.
Opening instead the url `http://localhost:8888/notebook/Untitled.ipynb` will open in read-only mode (notice the difference between "notebookS" and "notebook").