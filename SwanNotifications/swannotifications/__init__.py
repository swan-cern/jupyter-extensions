
def _jupyter_nbextension_paths():
    # Used by "jupyter nbextension" command to install frontend extension
    return [dict(
                section="common",
                src="js",
                dest="swannotifications",
                require="swannotifications/extension"),
            ]

def _jupyter_server_extension_paths():
    # Empty to avoid error when automatically trying to enable all serverextensions
    return []