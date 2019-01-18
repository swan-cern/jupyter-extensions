

def _jupyter_nbextension_paths():
    # Used by "jupyter nbextension" command to install frontend extension
    return [dict(
                src="js",
                section="tree",
                dest="swangallery",
                require="swangallery/extension"),
            ]

def _jupyter_server_extension_paths():
    """Used by "jupyter serverextension" command to install web server extension'"""
    return [{
        "module": "swangallery.gallery"
    }]
