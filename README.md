## Jupyter extensions

Repository that stores all the Jupyter extensions for SWAN.

* [HdfsBrowser](HdfsBrowser) - Extension to browse Hadoop
* [SparkConnector](SparkConnector) - Helper to connect to CERN's Spark Clusters
* [SparkMonitor](SparkMonitor) - Live monitoring of Apache Spark Jobs spawned from a notebook
* [SwanContents](SwanContents) - Contents Manager for Jupyter with Projects functionality and SWAN templates
* [SwanHelp](SwanHelp) - SWAN Help panel for Notebooks and Lab
* [SwanIntro](SwanIntro) - Extension to display to users what has changed since the last time they used the service (or greet new users)
* [SwanKernelEnv](SwanKernelEnv) - Kernel extension to remove SWAN special paths from the user environment (thus keeping the clean LCG release environment)
* [SwanNotebookViewer](SwanNotebookViewer) - Read-only mode for opening notebooks (used from the Sharing interface) inside Jupyter Notebooks
* [SwanNotifications](SwanNotifications) - Extension to display notifications to users
* [SwanOauthRenew](SwanOauthRenew) - Extension that fetches the latest oAuth tokens from JupyterHub and writes to the file observed by EOS
* [SwanShare](SwanShare) - Jupyter Notebooks/CERNBox sharing integration used by SwanContents

### Development

#### Create a release

The creation of a new release in this repo is now automated. Just run the Github action "Release" manually, and specify the extension name and the increment type.