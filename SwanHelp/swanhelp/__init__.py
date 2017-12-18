
def _jupyter_nbextension_paths():
    # Used by "jupyter nbextension" command to install frontend extension
    return [dict(
                section="tree",
                src="js",
                dest="swanhelp",
                require="swanhelp/extension"),
            dict(
                section="notebook",
                src="js",
                dest="swanhelp",
                require="swanhelp/extension"),
            ]