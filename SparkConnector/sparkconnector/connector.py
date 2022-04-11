ipykernel_imported = True
try:
    from ipykernel import zmqshell
except ImportError:
    ipykernel_imported = False

import os, logging, tempfile, subprocess
from pyspark import SparkContext
from pyspark.sql import SparkSession

from swanportallocator.portallocator import PortAllocatorClient, NoPortsException, GeneralException

from .configuration import SparkConfigurationFactory
from .logreader import LogReader


class SparkConnector:
    """ Main singleton object for the kernel extension """

    def __init__(self, ipython, log):
        """ Constructor """
        self.ipython = ipython
        self.log = log
        self.connected = False
        self.file_thread = LogReader(self, log)
        log_path = self.file_thread.create_file()
        self.log4j_file = self.create_properties_file(log_path)
        self.file_thread.start()
        self.port_allocator = PortAllocatorClient()
        self.spark_configuration = SparkConfigurationFactory(connector=self).create()

    def send(self, msg):
        """Send a message to the frontend"""
        self.comm.send(msg)

    def send_ok(self, page, config=None):
        """Send a message to frontend to switch to a specific page and append spark config"""
        self.send({'msgtype': page, 'config': config})

    def send_error(self, page, error):
        """Send a message to frontend to switch to a specific page and append error message"""
        self.send({'msgtype': page, 'error': error})

    def handle_comm_message(self, msg):
        """ Handle message received from frontend """

        action = msg['content']['data']['action']

        # Try to get a kerberos ticket
        if action == 'sparkconn-action-auth':

            # Execute kinit and pipe password directly to the process without exposing it.
            auth_kinit = msg['content']['data']['password']
            p = subprocess.Popen(['kinit'], stdin=subprocess.PIPE, universal_newlines=True)
            p.communicate(input=auth_kinit)

            if p.wait() == 0:
                self.send_ok('sparkconn-config')
            else:
                self.send_error('sparkconn-auth', 'Error obtaining the ticket. Is the password correct?')

        elif action == 'sparkconn-action-connect':

            # The user is already connected, tell the frontend
            if self.connected:
                self.send_ok(
                    'sparkconn-connected',
                    self.spark_configuration.get_spark_session_config()
                )
                return

            try:
                # Ask port allocator to reserve and return 3 available ports
                self.port_allocator.connect()
                ports = self.port_allocator.get_ports(3)

                # Fetch delegation tokens from an external service
                if self.spark_configuration.get_spark_needs_auth():
                    # Do nothing if generating kerberos ticket prompting the password from user. (for nxcals)
                    self.log.info("Skipped fetching delegation tokens because SPARK_AUTH_REQUIRED")
                elif os.environ.get('SWAN_FETCH_HADOOP_TOKENS','false') == 'true':
                    self.spark_configuration.fetch_auth_delegation_tokens()
                else:
                    self.log.info("Skipped fetching delegation tokens.")

                conf = self.spark_configuration.configure(
                    msg['content']['data'],
                    ports
                )

                sc = SparkContext(conf=conf)
                spark = SparkSession(sc)

                self.ipython.push({"swan_spark_conf": conf, "sc": sc, "spark": spark})  # Add to users namespace

                # Tell frontend
                self.send_ok(
                    'sparkconn-connected',
                    self.spark_configuration.get_spark_session_config()
                )

                # Set state to connected for connector
                self.connected = True
                # Tell port allocator that the connection was successfull to prevent it from cleaning the ports
                self.port_allocator.set_connected()

            except NoPortsException:
                    self.send_error('sparkconn-connect-error', 'You reached the maximum number of parallel Spark connections. '
                                                        'Please shutdown a notebook connected to Spark to open more. '
                                                        'If you already did, please wait a few seconds more.')

            except GeneralException:
                    self.send_error('sparkconn-connect-error', 'Unknown error obtaining the ports for Spark connection.')

            except Exception as ex:
                # Mark ports as available to get cleaned and given to other processes
                self.port_allocator.set_disconnected()

                # Java errors follow specific format
                exact_java_error = str(ex).split('\n\tat')[0]
                self.send_error('sparkconn-connect-error', exact_java_error)
                self.log.error("Error creating Spark application", exc_info=True)

        elif action == 'sparkconn-action-getlogs':
            self.file_thread.send_log_tail()
            return

        elif action == 'sparkconn-action-disconnect':
            self.spark_configuration.close_spark_session()
            self.connected = False

        else:
            # Unknown action requested
            self.log.error("Received wrong message: %s", str(msg))
            return

    def register_comm(self):
        """ Register a comm_target which will be used by frontend to start communication """
        self.ipython.kernel.comm_manager.register_target(
            "SparkConnector", self.target_func)

    def target_func(self, comm, msg):
        """ Callback function to be called when a frontend comm is opened """
        self.log.info("Established connection to frontend")
        self.log.debug("Received message: %s", str(msg))
        self.comm = comm

        @self.comm.on_msg
        def _recv(msg):
            self.handle_comm_message(msg)

        # Check the current status of the kernel and tell frontend
        # If the user refreshes the page, he will still see the correct state
        if self.connected:
            page = 'sparkconn-connected'
        elif self.spark_configuration.get_spark_needs_auth():
            page = 'sparkconn-auth'
        else:
            page = 'sparkconn-config'

        # Send information about the configs selected on spawner
        self.send({'msgtype': 'sparkconn-action-open',
                   'maxmemory': self.spark_configuration.get_spark_memory(),
                   'sparkversion': self.spark_configuration.get_spark_version(),
                   'cluster': self.spark_configuration.get_cluster_name(),
                   'page': page})

        if self.connected:
            # If connected, additionally propagate connection config
            self.send_ok(
                'sparkconn-connected',
                self.spark_configuration.get_spark_session_config()
            )

    def create_properties_file(self, log_path):
        """ Creates a configuration file for Spark log4j """

        fd, path = tempfile.mkstemp()
        os.close(fd) # Reopen tempfile because mkstemp opens it in binary format
        f = open(path, 'w')

        __location__ = os.path.realpath(
            os.path.join(os.getcwd(), os.path.dirname(__file__)))
        f_configs = open(os.path.join(__location__, 'log4j_conf'), "r")

        for line in f_configs:
            f.write(line)

        f.write(u'log4j.appender.file.File=%s\n' % log_path)

        f_configs.close()
        f.close()
        self.log.info("Created temporary Log4j configuration file: %s", path)

        return path


def load_ipython_extension(ipython):
    """ Load Jupyter kernel extension """

    log = logging.getLogger('tornado.sparkconnector.connector')
    log.name = 'SparkConnector.connector'
    log.setLevel(logging.INFO)
    log.propagate = True

    if ipykernel_imported:
        if not isinstance(ipython, zmqshell.ZMQInteractiveShell):
            log.error("SparkConnector: Ipython not running through notebook. So exiting.")
            return
    else:
        return

    log.info("Starting SparkConnector Kernel Extension")
    monitor = SparkConnector(ipython, log)
    monitor.register_comm()
