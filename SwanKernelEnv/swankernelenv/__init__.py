from ._version import __version__ 
from .cleaner import *

__all__ = [ "__version__" ]


def _jupyter_nbextension_paths():
    # Empty to avoid error when automatically trying to enable all nbextensions
    return []
