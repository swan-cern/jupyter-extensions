import os, subprocess, shutil, sys, uuid, time, base64, tempfile
import requests

from pyspark import SparkConf, SparkContext
from string import Formatter

try:
    from kubernetes import config, client
    from kubernetes.client.rest import ApiException
except ImportError:
    pass
class SparkConfigurationFactory:

    def __init__(self, connector):
        self.connector = connector

    def create(self):
        cluster_name = os.environ.get('SPARK_CLUSTER_NAME', 'local')

        # Define configuration based on cluster type
        if cluster_name == 'local':
            # local
            return SparkLocalConfiguration(self.connector, cluster_name)
        elif cluster_name == 'k8s':
            # kubernetes
            return SparkK8sConfiguration(self.connector, cluster_name)
        else:
            # yarn
            return SparkYarnConfiguration(self.connector, cluster_name)


class SparkConfiguration(object):

    def __init__(self, connector, cluster_name):
        self.cluster_name = cluster_name
        self.connector = connector

    def get_cluster_name(self):
        """ Get cluster name """
        return self.cluster_name

    def get_spark_memory(self):
        """ Get spark max memory """
        return os.environ.get('MAX_MEMORY', '2')

    def get_spark_version(self):
        """ Get spark version """
        from pyspark import __version__ as spark_version
        return spark_version

    def get_spark_user(self):
        """ Get cluster name """
        return os.environ.get('SPARK_USER', '')

    def get_spark_needs_auth(self):
        """ Do not require auth if SPARK_AUTH_REQUIRED is 0,
        e.g. in case HADOOP_TOKEN_FILE_LOCATION has been provided
        """
        return os.environ.get('SPARK_AUTH_REQUIRED', 'false') == 'true'

    def close_spark_session(self):
        sc = self.connector.ipython.user_ns.get('sc')
        if sc and isinstance(sc, SparkContext):
            sc.stop()

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

    def fetch_auth_delegation_tokens(self):
        cluster = self.get_cluster_name()
        if not cluster or cluster == 'local':
            return
        jupyterhub_user_token = os.environ.get('JUPYTERHUB_API_TOKEN')
        url = os.environ.get('SWAN_HADOOP_TOKEN_GENERATOR_URL')
        headers = {
            'Authorization': f'token {jupyterhub_user_token}'
        }
        data = {
            'cluster': cluster
        }
        self.connector.log.info(f'Fetching hadoop delegation token for {cluster}')
        response = requests.post(f'{url}/generate-delegation-token', headers=headers, json=data)
        response.raise_for_status()

        # Write the token to a temporary file
        fd, path = tempfile.mkstemp(prefix="hadoop_token_")
        with os.fdopen(fd, 'wb') as file:
            file.write(response.content)
        
        os.environ['HADOOP_TOKEN_FILE_LOCATION'] = path
        self.connector.log.info(f'Hadoop delegation token written to {path}')

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

        # Fill extra_java_options as a concatenation of:
        # 1. SPARK_DRIVER_EXTRA_JAVA_OPTIONS variable, set for example to load required NXCALS settings
        # 2. Options configured by the user via the UI of SparkConnector
        # 3. Base Java options with log4j configuration
        # User's options should take precedence over the base option
        env_extra_java_options = os.environ.get("SPARK_DRIVER_EXTRA_JAVA_OPTIONS", "").strip()
        user_extra_java_options = conf.get("spark.driver.extraJavaOptions", "")
        logging_extra_java_options = "-Dlog4j2.configurationFile=%s" % self.connector.log4j_file
        
        extra_java_options = f"{env_extra_java_options} {user_extra_java_options} {logging_extra_java_options}"
        conf.set("spark.driver.extraJavaOptions", extra_java_options)

        # Extend conf ensuring that LD_LIBRARY_PATH on executors is the same as on the driver
        ld_library_path = conf.get('spark.executorEnv.LD_LIBRARY_PATH')
        if ld_library_path:
            ld_library_path = ld_library_path + ":" + os.environ.get('LD_LIBRARY_PATH', '')
        else:
            ld_library_path = os.environ.get('LD_LIBRARY_PATH', '')
        conf.set('spark.executorEnv.LD_LIBRARY_PATH', ld_library_path)

        # Extend conf with ports for the driver and block manager
        conf.set('spark.driver.host', os.environ.get('SERVER_HOSTNAME', 'localhost'))
        conf.set('spark.driver.port', ports[0])
        conf.set('spark.driver.blockManager.port', ports[1])
        conf.set('spark.port.maxRetries', 100)
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

    def get_spark_session_config(self):
        conn_config = {}

        sc = self.connector.ipython.user_ns.get('sc')
        if sc and isinstance(sc, SparkContext):
            webui_url = 'http://' + sc._conf.get('spark.driver.host') + ':' + sc._conf.get('spark.ui.port')
            conn_config['sparkwebui'] = webui_url
        return conn_config


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

    def _refresh_spark_tokens(self, name, namespace, data_dict):
        """ Create or replace k8s secret <name> in the namespace <namespace """

        config.load_kube_config()

        api_instance = client.CoreV1Api()

        try:
            # Refresh tokens, so new executors will pick up new token
            api_instance.read_namespaced_secret(name, namespace)
            exists = True
        except ApiException:
            exists = False

        secret_data = client.V1Secret()

        secret_meta = client.V1ObjectMeta()
        secret_meta.name = name
        secret_meta.namespace = namespace
        secret_data.metadata = secret_meta

        secret_data.data = {}
        for secret_key, file_path in data_dict.items():
            try:
                with open(file_path, "r") as file:
                    data = file.read()
            except UnicodeDecodeError:
                with open(file_path, "rb") as file:
                    data = file.read()

            secret_data.data[secret_key] =  base64.standard_b64encode(data).decode('ascii')

        try:
            # Refresh tokens, so new executors will pick up new token
            if exists:
                api_instance.replace_namespaced_secret(name, namespace, secret_data)
            else:
                api_instance.create_namespaced_secret(namespace, secret_data)
        except ApiException as e:
            raise Exception("Could not create required secret: %s\n" % e)

    def configure(self, opts, ports):
        """ Initialize K8s configuration for Spark """

        conf = super(self.__class__, self).configure(opts, ports)

        # Set K8s configuration
        conf.set('spark.kubernetes.namespace', os.environ.get('SPARK_USER'))
        conf.set('spark.kubernetes.container.image', 'gitlab-registry.cern.ch/db/spark-service/docker-registry/swan:alma9-20240123')
        conf.set('spark.master', self._retrieve_k8s_master(os.environ.get('KUBECONFIG')))

        # Configure shuffle if running on K8s with Spark 3.x.x
        if self.get_spark_version().split('.')[0]=='3':
            conf.set('spark.shuffle.service.enabled', 'false')
            conf.set('spark.dynamicAllocation.shuffleTracking.enabled', 'true')

        # Ensure that Spark ENVs on executors are the same as on the driver
        conf.set('spark.executorEnv.PYTHONPATH', os.environ.get('PYTHONPATH'))
        conf.set('spark.executorEnv.JAVA_HOME', os.environ.get('JAVA_HOME'))
        conf.set('spark.executorEnv.SPARK_HOME', os.environ.get('SPARK_HOME'))
        conf.set('spark.executorEnv.SPARK_EXTRA_CLASSPATH', os.environ.get('SPARK_DIST_CLASSPATH'))

        # Disable console progress as it would be printed in the notebook (since ipython 6)
        conf.set('spark.ui.showConsoleProgress', 'false')

        # Authenticate EOS and HDFS also on spark executors by
        # telling spark to mount spark-tokens secret to each executor and set env pointing to secret data
        secret_data = {}
        if "KRB5CCNAME" in os.environ and os.path.exists(os.environ.get('KRB5CCNAME')):
            secret_data["krb5cc"] = os.environ.get('KRB5CCNAME')
            conf.set('spark.kubernetes.executor.secrets.spark-tokens', '/tokens')
            conf.set('spark.executorEnv.KRB5CCNAME', '/tokens/krb5cc')

        if "HADOOP_TOKEN_FILE_LOCATION" in os.environ and os.path.exists(os.environ.get('HADOOP_TOKEN_FILE_LOCATION')):
            secret_data["hadoop.toks"] = os.environ.get('HADOOP_TOKEN_FILE_LOCATION')
            conf.set('spark.kubernetes.executor.secrets.spark-tokens', '/tokens')
            conf.set('spark.executorEnv.HADOOP_TOKEN_FILE_LOCATION', '/tokens/hadoop.toks')

        # Create/replace spark-tokens secret with HADOOP_TOKEN_FILE_LOCATION and KRB5CCNAME if set
        self._refresh_spark_tokens(
            "spark-tokens",
            os.environ.get('SPARK_USER'),
            secret_data
        )

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

    def get_spark_session_config(self):
        conn_config = {}
        sc = self.connector.ipython.user_ns.get('sc')
        if sc and isinstance(sc, SparkContext):
            # set the metrics URL if the config bundle is selected
            if sc._conf.get('spark.cern.grafana.url') is not None:
                # if spark.cern.grafana.url is set, use cern spark monitoring dashboard
                conn_config['sparkmetrics'] = sc._conf.get('spark.cern.grafana.url') + \
                                              '&var-ClusterName=' + self.get_cluster_name() + \
                                              '&var-UserName=' + self.get_spark_user() + \
                                              '&var-ApplicationId=' + sc._conf.get('spark.app.id')

            webui_url = 'http://' + sc._conf.get('spark.driver.host') + ':' + sc._conf.get('spark.ui.port')
            conn_config['sparkwebui'] = webui_url

        return conn_config


class SparkYarnConfiguration(SparkConfiguration):

    def _get_sc_config(self, key, wait=False):
        """ It can happen that context will be returned by pyspark, but some yarn configs are late propagated """
        sc = self.connector.ipython.user_ns.get('sc')

        if wait:
            # try to get config by key 10 times with wait of 1s
            num_tries = 10
            for i in range(num_tries):
                conf_val = sc._conf.get(key, None)
                if conf_val:
                    return conf_val
                time.sleep(1)

        # return config by key if exists, or None
        return sc._conf.get(key, None)

    def configure(self, opts, ports):
        """ Initialize YARN configuration for Spark """

        conf = super(self.__class__, self).configure(opts, ports)

        # Initialize YARN Specific configuration
        conf.set('spark.master', 'yarn')

        # Archive the local python packages and set spark.submit.pyFiles if the propagate python packages bundle is selected
        if conf.get('spark.cern.user.pyModules') is not None:
           python_version = f"{sys.version_info.major}.{sys.version_info.minor}"
           dir_name=os.environ['HOME']+'/.local/lib/python'+python_version+'/site-packages'
           filename = '/tmp/'+str(uuid.uuid4().hex)
           user_archive=shutil.make_archive(filename, 'zip', dir_name)
           if conf.get('spark.submit.pyFiles') is not None:
               archive_filename=conf.get('spark.submit.pyFiles')+','+user_archive
           else:
               archive_filename=user_archive
           conf.set('spark.submit.pyFiles', archive_filename)

        # Disable console progress as it would be printed in the notebook (since ipython 6)
        conf.set('spark.ui.showConsoleProgress', 'false')

        return conf

    def get_spark_session_config(self):
        conn_config = {}
        sc = self.connector.ipython.user_ns.get('sc')
        if sc and isinstance(sc, SparkContext):
            # set the metrics URL if the config bundle is selected
            conn_config = {}

            grafana_url = self._get_sc_config('spark.cern.grafana.url')
            app_id = self._get_sc_config('spark.app.id')
            if grafana_url and app_id:
                # if spark.cern.grafana.url is set, use cern spark monitoring dashboard
                conn_config['sparkmetrics'] = grafana_url + \
                                              '&var-ClusterName=' + self.get_cluster_name() + \
                                              '&var-UserName=' + self.get_spark_user() + \
                                              '&var-ApplicationId=' + app_id

            # Determine the WebUI URL for Spark on YARN
            # First, we get a list of 2 potential proxy addresses,
            # one for each YARN RM (we have 2 Resource Managers in our Hadoop configs)
            # Example result:
            # 'https://ithdpXXX1.cern.ch:8088/proxy/application_1688370955275_70252,
            # https://ithdpXXX2.cern.ch:8088/proxy/application_1688370955275_70252'
            # Then we simply take the first one and use it as the WebUi URL
            webui_urls = self._get_sc_config(
                'spark.org.apache.hadoop.yarn.server.webproxy.amfilter.AmIpFilter.param.PROXY_URI_BASES',
                wait=True
            )
            if webui_urls:
                conn_config['sparkwebui'] = webui_urls.split(',', 1)[0]

        return conn_config
