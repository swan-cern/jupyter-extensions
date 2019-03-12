ipykernel_imported = True
try:
    from ipykernel import zmqshell
except ImportError:
    ipykernel_imported = False

import os, sys, json, logging, tempfile, time, subprocess
from pyspark import SparkConf, SparkContext
from pyspark.sql import SparkSession
from threading import Thread
from string import Formatter

from .portallocator import PortsAllocatorClient, NoPortsException, GeneralException

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
        self.port_allocator = PortsAllocatorClient()

        self.cluster_name = os.environ.get('SPARK_CLUSTER_NAME')
        self.needs_auth = (self.cluster_name == "nxcals")

        # Define configuration based on cluster type
        if self.cluster_name == 'local':
            # local
            self.spark_configuration = SparkLocalConfiguration(self)
        elif self.cluster_name == 'k8s':
            # kubernetes
            self.spark_configuration = SparkK8sConfiguration(self)
        else:
            # yarn
            self.spark_configuration = SparkYarnConfiguration(self)

    def send(self, msg):
        """Send a message to the frontend"""
        self.comm.send(msg)

    def send_ok(self, page, config=""):
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
                self.send_ok('sparkconn-connected')
                return

            # As of today, NXCals still requires a valid kerberos token to
            # access their own API.
            if self.needs_auth and not subprocess.call(['klist', '-s']) == 0:
                self.send_error('sparkconn-auth', 'No valid credentials provided.')
                return


            try:
                # Ask port allocator to reserve and return 3 available ports
                self.port_allocator.connect()
                ports = self.port_allocator.get_ports(3)

                conf = self.spark_configuration.configure(
                    msg['content']['data'],
                    ports
                )

                sc = SparkContext(conf=conf)
                spark = SparkSession(sc)

                self.ipython.push({"swan_spark_conf": conf, "sc": sc, "spark": spark})  # Add to users namespace

                # set the metrics URL if the config bundle is selected
                if sc._conf.get('spark.metrics.conf.driver.sink.graphite.class') is not None:
                    metricsurl = 'https://hadoop-grafana.web.cern.ch/d/T6lgZ90mk/sparkmetrics?orgId=1&var-ClusterName='+self.cluster_name+'&var-UserName=pkothuri&var-ApplicationId='+sc._conf.get('spark.app.id')
                else:
                    metricsurl = "OFF"

                # determine the history server URL depending on the selected resource manager (yarn, k8s, local etc)
                if "yarn" in sc._conf.get('spark.master'):
                    historyserver = sc._conf.get('spark.org.apache.hadoop.yarn.server.webproxy.amfilter.AmIpFilter.param.PROXY_URI_BASES').split(',', 1)[0]
                else:
                    historyserver = 'http://' + sc._conf.get('spark.driver.host') + ':' + sc._conf.get('spark.ui.port')

                sparkconfig = {'sparkmetrics': metricsurl, 'sparkhistoryserver': historyserver}
                self.send_ok('sparkconn-connected', sparkconfig) # Tell frontend
                self.connected = True
                # Tell port allocator that the connection was successfull to prevent it from cleaning the ports
                self.port_allocator.set_connected()

            except NoPortsException:
                    self.send_error('sparkconn-config', 'You reached the maximum number of parallel Spark connections. '
                                                        'Please shutdown a notebook connected to Spark to open more. '
                                                        'If you already did, please wait a few seconds more.')

            except GeneralException:
                    self.send_error('sparkconn-config', 'Unknown error obtaining the ports for Spark connection.')

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
            self.close_spark_session()
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
        elif self.needs_auth and not subprocess.call(['klist', '-s']) == 0:
            page = 'sparkconn-auth'
        else:
            page = 'sparkconn-config'

        # Send information about the configs selected on spawner
        self.send({'msgtype': 'sparkconn-action-open',
                   'maxmemory': os.environ.get('MAX_MEMORY'),
                   'cluster': self.cluster_name,
                   'page': page})

    def close_spark_session(self):
        spark_context = self.ipython.user_ns.get('sc')
        if spark_context and isinstance(spark_context, SparkContext):
            spark_context.stop()

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


class SparkConfiguration(object):

    def __init__(self, connector):
        self.connector = connector

    def _parse_options(self, _opts):
        """ Parse options and set defaults """
        _options = {}
        if 'options' in _opts:
            for name, value in _opts['options'].items():
                replaceable_values = {}
                for _, variable, _, _ in Formatter().parse(value):
                    if variable is not None:
                        replaceable_values[variable] = os.environ.get(variable)

                value = value.format(**replaceable_values)
                _options[name] = value
        return _options

    def configure(self, opts, ports):
        """ Initializes Spark configuration object """

        # Check if there's already a conf variablex
        # If using SparkMonitor, this is defined but is of type SparkConf
        conf = self.connector.ipython.user_ns.get('swan_spark_conf')
        if conf:
            self.connector.log.warn("conf already exists: %s", conf.toDebugString())
            if not isinstance(conf, SparkConf):
                raise Exception('There is already a "swan_spark_conf" variable defined and is not of type SparkConf.')
        else:
            conf = SparkConf()  # Create a new conf

        options = self._parse_options(opts)

        # Do not overwrite the existing driver extraClassPath with option, add instead
        def_conf_extra_class_path = conf.get('spark.driver.extraClassPath', '')
        options_extra_class_path = options.get('spark.driver.extraClassPath', '')
        if def_conf_extra_class_path != '' and options_extra_class_path != '':
            options['spark.driver.extraClassPath'] = def_conf_extra_class_path + ":" + options_extra_class_path
        elif def_conf_extra_class_path != '' and options_extra_class_path == '':
            options['spark.driver.extraClassPath'] = def_conf_extra_class_path
        elif def_conf_extra_class_path == '' and options_extra_class_path != '':
            options['spark.driver.extraClassPath'] = options_extra_class_path

        # Add options to the default conf
        for name, value in options.items():
            conf.set(name, value)

        # Extend conf adding logging of log4j to java options
        base_extra_java_options = "-Dlog4j.configuration=file:%s" % self.connector.log4j_file
        extra_java_options = conf.get("spark.driver.extraJavaOptions")
        if extra_java_options:
            extra_java_options = base_extra_java_options + " " + extra_java_options
        else:
            extra_java_options = base_extra_java_options
        conf.set("spark.driver.extraJavaOptions", extra_java_options)

        # Extend conf ensuring that LD_LIBRARY_PATH on executors is the same as on the driver
        ld_library_path = conf.get('spark.executorEnv.LD_LIBRARY_PATH')
        if ld_library_path:
            ld_library_path = ld_library_path + ":" + os.environ.get('LD_LIBRARY_PATH')
        else:
            ld_library_path = os.environ.get('LD_LIBRARY_PATH')
        conf.set('spark.executorEnv.LD_LIBRARY_PATH', ld_library_path)

        # Extend conf with ports for the driver and block manager
        conf.set('spark.driver.host', os.environ.get('SERVER_HOSTNAME'))
        conf.set('spark.driver.port', ports[0])
        conf.set('spark.blockManager.port', ports[1])
        conf.set('spark.ui.port', ports[2])

        # Extend conf with spark app name to allow the monitoring and filtering of SWAN jobs in the Spark clusters
        app_name = conf.get('spark.app.name')
        conf.set('spark.app.name', app_name + '_swan' if app_name else 'pyspark_shell_swan')

        return conf


class SparkLocalConfiguration(SparkConfiguration):

    def configure(self, opts, ports):
        """ Initialize YARN configuration for Spark """

        conf = super(self.__class__, self).configure(opts, ports)

        conf.set('spark.master', 'local[*]')
        return conf

class SparkK8sConfiguration(SparkConfiguration):

    def _format_local_paths(self, path_array):
        """ Dependencies which are in EOS HOME will be formatted to root:// """

        spark_work_dir = None
        for dh in self.connector.ipython.user_ns.get('_dh'):
            if dh.startswith('/eos/home') and 'SWAN_projects' in dh:
                # Adjust /eos/home path to /eos/user xrootd access
                spark_work_dir = dh.replace('/eos/home', 'root://eoshome.cern.ch//eos/user', 1).replace('-', '/', 1)
                break

        adjusted_paths = []
        for path in path_array:
            if spark_work_dir and path.startswith('./'):
                adjusted_path = path.replace('.', spark_work_dir, 1)
                if " " in adjusted_path:
                    raise Exception(
                        'Could not stage dependencies with spark.files, spark.jars or spark.submit.pyFiles '
                        'which include space in the name of the project or path')
                adjusted_paths.append(adjusted_path)
            elif path.startswith('/'):
                raise Exception('Staging of dependencies not allowed from all local paths. '
                                'Please use your notebook directory ./, root://, http:// or s3a://')
            else:
                adjusted_paths.append(path)

        return ",".join(adjusted_paths)

    def _retrieve_k8s_master(self, kubeconfig_path):
        """ Extract k8s master ip from kubeconfig """
        with open(kubeconfig_path) as f:
            for line in f.readlines():
                server = line.split("server:")
                if len(server) == 2:
                    return "k8s://" + server[1].strip()

    def configure(self, opts, ports):
        """ Initialize K8s configuration for Spark """

        conf = super(self.__class__, self).configure(opts, ports)

        # Set K8s configuration
        conf.set('spark.kubernetes.namespace', os.environ.get('SPARK_USER'))
        conf.set('spark.master', self._retrieve_k8s_master(os.environ.get('KUBECONFIG')))

        # Ensure that Spark ENVs on executors are the same as on the driver
        conf.set('spark.executorEnv.PYTHONPATH', os.environ.get('PYTHONPATH'))
        conf.set('spark.executorEnv.JAVA_HOME', os.environ.get('JAVA_HOME'))
        conf.set('spark.executorEnv.SPARK_HOME', os.environ.get('SPARK_HOME'))
        conf.set('spark.executorEnv.SPARK_EXTRA_CLASSPATH', os.environ.get('SPARK_DIST_CLASSPATH'))

        # There is no resource staging server for files, download directly from storage to executors
        # Distribute files (for pyFiles add them also to files) and jars
        spark_files = conf.get('spark.files', '')
        conf.set('spark.files', self._format_local_paths(spark_files.split(",")))
        spark_jars = conf.get('spark.jars', '')
        conf.set('spark.jars', self._format_local_paths(spark_jars.split(",")))

        if conf.get('spark.submit.pyFiles', None):
            raise Exception('Option spark.submit.pyFiles is not recommended. '
                            'Please use e.g. spark.files=./bigdl.zip and sc.addPyFile("./bigdl.zip")')

        if conf.get('spark.yarn.dist.files', None) or \
                conf.get('spark.yarn.dist.jars', None) or \
                conf.get('spark.yarn.dist.archives', None):
            raise Exception('Kubernetes does not support syntax for YARN, use spark.files or spark.jars')

        return conf


class SparkYarnConfiguration(SparkConfiguration):

    def configure(self, opts, ports):
        """ Initialize YARN configuration for Spark """

        conf = super(self.__class__, self).configure(opts, ports)

        # Initialize YARN Specific configuration
        conf.set('spark.master', 'yarn')
        conf.set('spark.authenticate', True)
        conf.set('spark.network.crypto.enabled', True)
        conf.set('spark.authenticate.enableSaslEncryption', True)

        # Ensure that driver has extra classpath required for running on YARN
        base_extra_class_path = "/eos/project/s/swan/public/hadoop-mapreduce-client-core-2.6.0-cdh5.7.6.jar"
        extra_class_path = conf.get('spark.driver.extraClassPath')
        if extra_class_path:
            extra_class_path = base_extra_class_path + ":" + extra_class_path
        else:
            extra_class_path = base_extra_class_path
        conf.set('spark.driver.extraClassPath', extra_class_path)

        return conf


class LogReader(Thread):
    """ Thread to read a file where the logs from Spark are being written """

    def __init__(self, connector, log):
        self.connector = connector
        self.log = log
        self.path = None
        Thread.__init__(self)

    def format_log_line(self, line):
        return line.strip() + "\n\n"

    def tail(self, max_size=10*1024*1024):
        # Use rb mode to be able to seek backwards
        with open(self.path, 'rb') as f:
            try:
                # Seek in file from the end to max size
                f.seek(-max_size, os.SEEK_END)
            except IOError as e:
                # the file is below the max size
                f.seek(0)

            formatted_lines = []
            for line in f.readlines():
                formatted_lines.append(self.format_log_line(line.decode('utf-8')))
            return formatted_lines

    def send_log_tail(self):
        self.connector.send({
            'msgtype': 'sparkconn-action-tail-log',
            'msg': self.tail()
        })

    def create_file(self):
        """ Create a temporary file and return the path to it"""
        fd, path = tempfile.mkstemp(prefix="driver_log_")
        os.close(fd)
        self.log.info("Created temporary Log4j log file: %s", path)
        self.path = path
        return path

    def run(self):
        """ Read the log file and send the logs to frontend """
        logfile = open(self.path,"r")
        log_lines = self.follow(logfile)
        for line in log_lines:
            # Add double lines to the log-line for better readability
            self.connector.send({
                "msgtype": "sparkconn-action-follow-log",
                "msg": self.format_log_line(line)
            })

    # from "Generator Tricks for Systems Programmers"
    # (http://www.dabeaz.com/generators/)
    # Terminate when the user is connected
    def follow(self, logfile):
        logfile.seek(0,2)
        while not self.connector.connected:
            line = logfile.readline()
            if not line:
                time.sleep(0.1)
                continue
            yield line


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
