
ipykernel_imported = True
try:
    from ipykernel import zmqshell
except ImportError:
    ipykernel_imported = False

import sys, logging

def load_ipython_extension(ipython):
    """ Load Jupyter kernel extension """

    log = logging.getLogger('tornado.swankernelenv.cleaner')
    log.name = 'SwanKernelenv.cleaner'
    log.setLevel(logging.INFO)
    log.propagate = True

    if ipykernel_imported:
        if not isinstance(ipython, zmqshell.ZMQInteractiveShell):
            log.error("SwanKernelEnv: Ipython not running through notebook. So exiting.")
            return
    else:
        return

    # We're adding locally installed modules to the system path in order to provide 
    # extra extensions to the user env (i.e the kernel extensions)
    # But, as soon as the environment starts, the user should not have those paths available, only
    # the ones that were expected (user local paths and  CVMFS).
    # Specify the paths to still allow the path that contains 'IPython/extensions'.
    rejected_paths = ['/usr/local/lib/swan', '/usr/local/lib/swan/extensions']
    sys.path = [path for path in sys.path if path not in rejected_paths]
    log.info("SwanKernelEnv Kernel Extension done")
