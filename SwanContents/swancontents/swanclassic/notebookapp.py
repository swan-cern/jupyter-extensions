# coding: utf-8

from nbclassic.notebookapp import NotebookApp as ClassicNotebookApp

from nbclassic import DEFAULT_TEMPLATE_PATH_LIST as NBCLASSIC_DEFAULT_TEMPLATE_PATH_LIST
from nbclassic import DEFAULT_STATIC_FILES_PATH as NBCLASSIC_DEFAULT_STATIC_FILES_PATH

from . import (
    DEFAULT_TEMPLATE_PATH_LIST,
    DEFAULT_STATIC_FILES_PATH,
)
from .._version import __version__

from jupyter_server.transutils import _i18n
from jupyter_server.serverapp import load_handlers

from traitlets import Unicode
import datetime


class NotebookApp(ClassicNotebookApp):
    """
    SWANClassic is a wrapper of NBClassic
    It provides the Notebook UI (with the Swan personalization) with a
    Jupyter Server backend (as opposed to the old notebook backend).
    This way we automatically configure everything necessary, like our theme,
    handlers and configurations.
    """

    name = "swanclassic"
    version = __version__
    description = _i18n(
        """ SWAN wrapper for nbclassic.
            Serves the old Jupyter UI with the SWAN configurations (i.e templates) on top"""
    )

    default_url = Unicode("/projects").tag(config=True)

    static_paths = [DEFAULT_STATIC_FILES_PATH, NBCLASSIC_DEFAULT_STATIC_FILES_PATH]
    template_paths = DEFAULT_TEMPLATE_PATH_LIST + NBCLASSIC_DEFAULT_TEMPLATE_PATH_LIST

    def initialize_handlers(self):
        """
        Registers the old UI paths, like /projects, /share and /cernbox automatically.
        """
        handlers = []
        handlers.extend(load_handlers("swancontents.swanclassic.handlers.projects"))
        handlers.extend(load_handlers("swancontents.swanclassic.handlers.share"))
        handlers.extend(load_handlers("swancontents.swanclassic.handlers.cernbox"))
        handlers.extend(load_handlers("swancontents.swanclassic.handlers.notebookviewer"))
        self.handlers.extend(handlers)
        super(NotebookApp, self).initialize_handlers()

    def initialize_settings(self):
        """
        Initialize settings to extend the jinja variables configuration
        in order to use them in our theme templates
        """
        super(NotebookApp, self).initialize_settings()
        new_vars = (
            self.settings["jinja_template_vars"]
            if "jinja_template_vars" in self.settings
            else dict()
        )
        new_vars.update({"current_year": datetime.datetime.now().year})

        # Check if we are running via Jupyterhub single user (in that case, control url is defined),
        #  and set a required variable for the templates
        if 'hub_control_panel_url' in new_vars:
            control_url = new_vars['hub_control_panel_url']
            # Remove the prefix from the path (it's built by appending 'home' at the end)
            hub_prefix = '/'.join(control_url.split('/')[:-1]) + '/'
            new_vars.update({"hub_prefix": hub_prefix})

        if datetime.date.today().month == 12:
            # It's Christmas time!
            new_vars.update({"swan_logo_filename": "swan_letters_christmas.png"})
        else:
            new_vars.update({"swan_logo_filename": "logo_swan_letters.png"})
        self.settings.update({"jinja_template_vars": new_vars})


main = launch_new_instance = NotebookApp.launch_instance
