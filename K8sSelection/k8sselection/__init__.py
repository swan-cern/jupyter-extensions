def _jupyter_nbextension_paths():
    """ Used by "jupyter nbextension" command to install frontend extension """
    return [dict(
                section="notebook",
                src="js",
                dest="k8sselection",
                require="k8sselection/index"),
            ]
