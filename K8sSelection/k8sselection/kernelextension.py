ipykernel_imported = True
try:
    from ipykernel import zmqshell
except ImportError:
    ipykernel_imported = False

import os, logging
import io, yaml
from kubernetes import client, config
from kubernetes.client.rest import ApiException
from os.path import join, dirname


class AlreadyExistError(Exception):
    """Raises when any element(context, cluster) already exists in KUBECONFIG file"""

    def __init__(self, message):
        self.message = message

class K8sSelection:
    """
    This is the main class for the kernel extension.
    It will be used to handle all the backend tasks.
    """
    def __init__(self, ipython, log):
        self.ipython = ipython
        self.log = log

    def send(self, msg):
        """Send a message to the frontend"""
        self.comm.send(msg)

    def handle_comm_message(self, msg):
        """
        Handle message received from frontend.
        There are different actions received from frontend.
        Each action has a specific task to perfrom.
        Every action is handled seperately.
        """
        action = msg['content']['data']['action']

        if action == 'Refresh':
            pass
            self.cluster_list()
        elif action == 'change-current-context':
            # This action handles the requests from the frontend to change the current context in KUBECONFIG file

            context = msg['content']['data']['context']

            # Logging just for testing purposes
            self.log.info("Context from frontend: ", context)

            # Opening the YAML file using the yaml library
            with io.open(os.environ['HOME'] + '/.kube/config', 'r', encoding='utf8') as stream:
                load = yaml.safe_load(stream)

            # Setting the current context
            load['current-context'] = context

            # Writing to the file
            with io.open(os.environ['HOME'] + '/.kube/config', 'w', encoding='utf8') as out:
                yaml.safe_dump(load, out, default_flow_style=False, allow_unicode=True)

            # Sending the message back to frontend
            self.send({
                'msgtype': 'changed-current-context'
            })
        elif action == 'add-context-cluster':
            # This action adds the cluster and context information in the KUBECONFIG file received from the user

            # Here the tab is mode i.e. local, openstack, etc
            tab = msg['content']['data']['tab']

            # We can handle different modes using conditions
            if tab == 'local':
                # Getting all the input data.
                # Note that here we assume that the context name is same as cluster name.
                token = msg['content']['data']['token']
                cluster_name = msg['content']['data']['cluster_name']
                insecure_server = msg['content']['data']['insecure_server']
                ip = msg['content']['data']['ip']
                namespace = "swan-" + str(os.getenv('USER'))
                svcaccount = str(os.getenv('USER')) + "-" + cluster_name
                context_name = cluster_name

                # Checking whether user wants an insecure cluster or not
                if insecure_server == "false":
                    catoken = msg['content']['data']['catoken']

                #Setting environment variables to use in bash scripts
                os.environ['SERVICE_ACCOUNT'] = svcaccount
                os.environ['TOKEN'] = token
                os.environ['CONTEXT_NAME'] = context_name
                os.environ['CLUSTER_NAME'] = cluster_name
                os.environ['NAMESPACE'] = namespace
                os.environ['SERVER_IP'] = ip
                if insecure_server == "false":
                    os.environ['CATOKEN'] = catoken

                # The main logic
                try:
                    # Check whether KUBECONFIG file exists in the default localtion.
                    # If not then create the folder and file and initialize it.
                    if os.path.isdir(os.getenv('HOME') + '/.kube'):
                        if not os.path.isfile(os.getenv('HOME') + '/.kube/config'):
                            load = {}
                            load['apiVersion'] = 'v1'
                            load['clusters'] = []
                            load['contexts'] = []
                            load['current-context'] = ''
                            load['kind'] = 'Config'
                            load['preferences'] = {}
                            load['users'] = []

                            with io.open(os.environ['HOME'] + '/.kube/config', 'w', encoding='utf8') as out:
                                yaml.safe_dump(load, out, default_flow_style=False, allow_unicode=True)
                    else:
                        os.makedirs(os.getenv('HOME') + '/.kube')

                        load = {}
                        load['apiVersion'] = 'v1'
                        load['clusters'] = []
                        load['contexts'] = []
                        load['current-context'] = ''
                        load['kind'] = 'Config'
                        load['preferences'] = {}
                        load['users'] = []

                        with io.open(os.environ['HOME'] + '/.kube/config', 'w', encoding='utf8') as out:
                            yaml.safe_dump(load, out, default_flow_style=False, allow_unicode=True)

                    # Load the KUBECONFIG file
                    with io.open(os.environ['HOME'] + '/.kube/config', 'r', encoding='utf8') as stream:
                        load = yaml.safe_load(stream)

                    contexts = []
                    clusters = []

                    # Get all the context names
                    for i in load['contexts']:
                        contexts.append(i['name'])

                    # Get all the cluster names
                    for i in load['clusters']:
                        clusters.append(i['name'])

                    # Check whether the cluster already exists
                    if cluster_name in clusters:
                        raise AlreadyExistError('Cluster \'{}\' already exist.'.format(cluster_name))

                    # Check whether the context already exists
                    if context_name in contexts:
                        raise AlreadyExistError('Context \'{}\' already exist.'.format(context_name))


                    # Add Cluster to the KUBECONFIG file
                    if insecure_server == "false":
                        load['clusters'].append({
                            'cluster': {
                                'certificate-authority-data': catoken,
                                'server': ip
                            },
                            'name': cluster_name
                        })
                    else:
                        load['clusters'].append({
                            'cluster': {
                                'insecure-skip-tls-verify': True,
                                'server': ip
                            },
                            'name': cluster_name
                        })


                    # Add user to the KUBECONFIG file
                    flag = 0
                    for user in load['users']:
                        if svcaccount == user['name']:
                            if 'token' in user['user'].keys():
                                user['user']['token'] = token
                            flag = 1
                            break

                    if flag == 0:
                        load['users'].append({
                            'user': {
                                'token': token,
                            },
                            'name': svcaccount
                        })


                    # Add Context to the KUBECONFIG file
                    load['contexts'].append({
                        'context': {
                            'cluster': cluster_name,
                            'namespace': namespace,
                            'user': svcaccount
                        },
                        'name': context_name
                    })

                    # Save the file
                    with io.open(os.environ['HOME'] + '/.kube/config', 'w', encoding='utf8') as out:
                        yaml.safe_dump(load, out, default_flow_style=False, allow_unicode=True)

                    # Check whether the newly added cluster is responding. If not then the error is handled below.
                    api_instance2 = client.CoreV1Api(api_client=config.new_client_from_config(context=context_name))
                    api_response = api_instance2.list_namespaced_pod(namespace=namespace)

                    self.send({
                        'msgtype': 'added-context-successfully',
                        'tab': 'local'
                    })
                except ApiException as e:
                    # If the newly added cluster is not responding then delete all the things added above
                    # and send an error to the user.
                    error = 'You cannot request resources using these settings. Please contact your admin'

                    with io.open(os.environ['HOME'] + '/.kube/config', 'r', encoding='utf8') as stream:
                        load = yaml.safe_load(stream)

                    for i in range(len(load['contexts'])):
                        if load['contexts'][i]['name'] == context_name:
                            load['contexts'].pop(i)
                            break

                    for i in range(len(load['clusters'])):
                        if load['clusters'][i]['name'] == cluster_name:
                            load['clusters'].pop(i)
                            break

                    for i in range(len(load['users'])):
                        if load['users'][i]['name'] == svcaccount:
                            load['users'].pop(i)
                            break

                    with io.open(os.environ['HOME'] + '/.kube/config', 'w', encoding='utf8') as out:
                        yaml.safe_dump(load, out, default_flow_style=False, allow_unicode=True)

                    self.send({
                        'msgtype': 'added-context-unsuccessfully',
                        'error': error,
                        'tab': 'local'
                    })
                except AlreadyExistError as e:
                    # If the context or the cluster already exists then send an error to the user
                    error = e.message

                    self.send({
                        'msgtype': 'added-context-unsuccessfully',
                        'error': error,
                        'tab': 'local'
                    })
                except:
                    # Handle general purpose exceptions
                    error = 'Cannot use these settings. Please contact the cluster administrator'

                    self.send({
                        'msgtype': 'added-context-unsuccessfully',
                        'error': error,
                        'tab': 'local'
                    })

            elif tab == 'openstack':
                # Same for the openstack mode. Get the input from the user.
                # The context name is same as cluster name
                cluster_name = msg['content']['data']['cluster_name']
                ip = msg['content']['data']['ip']
                catoken = msg['content']['data']['catoken']
                namespace = "swan-" + str(os.getenv('USER'))
                svcaccount = str(os.getenv('USER'))
                context_name = cluster_name

                try:
                    # Check if the KUBECONFIG file is present at default location. If not then create a file
                    if os.path.isdir(os.getenv('HOME') + '/.kube'):
                        if not os.path.isfile(os.getenv('HOME') + '/.kube/config'):
                            load = {}
                            load['apiVersion'] = 'v1'
                            load['clusters'] = []
                            load['contexts'] = []
                            load['current-context'] = ''
                            load['kind'] = 'Config'
                            load['preferences'] = {}
                            load['users'] = []

                            with io.open(os.environ['HOME'] + '/.kube/config', 'w', encoding='utf8') as out:
                                yaml.safe_dump(load, out, default_flow_style=False, allow_unicode=True)
                    else:
                        os.makedirs(os.getenv('HOME') + '/.kube')

                        load = {}
                        load['apiVersion'] = 'v1'
                        load['clusters'] = []
                        load['contexts'] = []
                        load['current-context'] = ''
                        load['kind'] = 'Config'
                        load['preferences'] = {}
                        load['users'] = []

                        with io.open(os.environ['HOME'] + '/.kube/config', 'w', encoding='utf8') as out:
                            yaml.safe_dump(load, out, default_flow_style=False, allow_unicode=True)

                    # Open the KUBECONFIG file
                    with io.open(os.environ['HOME'] + '/.kube/config', 'r', encoding='utf8') as stream:
                        load = yaml.safe_load(stream)

                    contexts = []
                    clusters = []

                    # Get all the cluster names
                    for i in load['clusters']:
                        clusters.append(i['name'])

                    # Get all the context names
                    for i in load['contexts']:
                        contexts.append(i['name'])

                    # Check if the cluster already exists
                    if cluster_name in clusters:
                        raise AlreadyExistError('Cluster \'{}\' already exist.'.format(cluster_name))

                    # Check if the context already exists
                    if context_name in contexts:
                        raise AlreadyExistError('Context \'{}\' already exist.'.format(context_name))

                    # The command which executes when using openstack keystone authentication
                    user_exec_command = {'exec': {'args': ['-c',
                                                           'if [ -z ${OS_TOKEN} ]; then\n    echo \'Error: Missing OpenStack credential from environment variable $OS_TOKEN\' > /dev/stderr\n    exit 1\nelse\n    echo \'{ "apiVersion": "client.authentication.k8s.io/v1alpha1", "kind": "ExecCredential", "status": { "token": "\'"${OS_TOKEN}"\'"}}\'\nfi\n'],
                                                  'command': '/bin/bash',
                                                  'apiVersion': 'client.authentication.k8s.io/v1alpha1'}}

                    # Add cluster to the KUBECONFIG file
                    load['clusters'].append({
                        'cluster': {
                            'certificate-authority-data': catoken,
                            'server': ip
                        },
                        'name': cluster_name
                    })

                    # Add context to the KUBECONFIG file
                    load['contexts'].append({
                        'context': {
                            'cluster': cluster_name,
                            'namespace': namespace,
                            'user': svcaccount
                        },
                        'name': context_name
                    })

                    # Add user to the KUBECONFIG file
                    flag = 0
                    for i in load['users']:
                        if i['name'] == svcaccount:
                            flag = 1
                            break

                    if flag == 0:
                        load['users'].append({
                            'user': user_exec_command,
                            'name': svcaccount
                        })

                    with io.open(os.environ['HOME'] + '/.kube/config', 'w', encoding='utf8') as out:
                        yaml.safe_dump(load, out, default_flow_style=False, allow_unicode=True)

                    # Check if we can request the newly added cluster.
                    # If not then it is handled below
                    api_instance2 = client.CoreV1Api(api_client=config.new_client_from_config(context=context_name))
                    api_instance2.list_namespaced_pod(namespace=namespace, timeout_seconds=2)

                    self.send({
                        'msgtype': 'added-context-successfully',
                        'tab': 'openstack'
                    })
                except ApiException as e:
                    # If you cannot request the newly added cluster then remove everything added above and
                    # send an error to the user.
                    error = 'You cannot request resources using these settings. Please contact your admin'

                    with io.open(os.environ['HOME'] + '/.kube/config', 'r', encoding='utf8') as stream:
                        load = yaml.safe_load(stream)

                    for i in range(len(load['contexts'])):
                        if load['contexts'][i]['name'] == context_name:
                            load['contexts'].pop(i)
                            break

                    for i in range(len(load['clusters'])):
                        if load['clusters'][i]['name'] == cluster_name:
                            load['clusters'].pop(i)
                            break

                    for i in range(len(load['users'])):
                        if load['users'][i]['name'] == svcaccount:
                            load['users'].pop(i)
                            break

                    with io.open(os.environ['HOME'] + '/.kube/config', 'w', encoding='utf8') as out:
                        yaml.safe_dump(load, out, default_flow_style=False, allow_unicode=True)

                    self.send({
                        'msgtype': 'added-context-unsuccessfully',
                        'error': error,
                        'tab': 'openstack'
                    })
                except AlreadyExistError as e:
                    # If the context or cluster already exists then send the error to the user.
                    error = e.message

                    self.send({
                        'msgtype': 'added-context-unsuccessfully',
                        'error': error,
                        'tab': 'openstack'
                    })
                except:
                    # Handle general purpose exceptions.
                    error = 'Cannot use these settings. Please contact the cluster administrator'

                    self.send({
                        'msgtype': 'added-context-unsuccessfully',
                        'error': error,
                        'tab': 'openstack'
                    })
        elif action == "show-error":
            # This is a very basic action which just sends the below error to the user.
            error = "Please fill all the required fields."
            state = msg['content']['data']['state']
            if state == 'create':
                self.send({
                    'msgtype': 'added-context-unsuccessfully',
                    'error': error
                })
            elif state == 'create_users':
                self.send({
                    'msgtype': 'added-user-unsuccessfully',
                    'error': error
                })
        elif action == "get-connection-detail":
            # This action checks whether the currently set context can request the resources from the cluster
            error = ''
            namespace = 'default'

            try:
                with io.open(os.environ['HOME'] + '/.kube/config', 'r', encoding='utf8') as stream:
                    load = yaml.safe_load(stream)

                contexts = load['contexts']
                for i in contexts:
                    if i['name'] == load['current-context']:
                        if 'namespace' in i['context'].keys():
                            namespace = i['context']['namespace']
                            break

                # Calling kubernetes API to list pods
                config.load_kube_config()
                api_instance = client.CoreV1Api()
                api_instance.list_namespaced_pod(namespace=namespace, timeout_seconds=2)

                self.send({
                    'msgtype': 'connection-details',
                    'context': load['current-context']
                })

            except ApiException as e:
                # If it cannot list pods then send the error to user
                error = 'Cannot list pods in your namespace'

                self.send({
                    'msgtype': 'connection-details-error',
                })
            except:
                # Handle general exception
                error = 'Cannot load KUBECONFIG'

                self.send({
                    'msgtype': 'connection-details-error',
                })
        elif action == "delete-current-context":
            # This action deletes the context and cluster from the KUBECONFIG file
            context = msg['content']['data']['context']

            try:
                # Open the file
                with io.open(os.environ['HOME'] + '/.kube/config', 'r', encoding='utf8') as stream:
                    load = yaml.safe_load(stream)

                # Delete the given cluster and context
                for i in range(len(load['contexts'])):
                    if load['contexts'][i]['name'] == context:
                        load['contexts'].pop(i)
                        break

                for i in range(len(load['clusters'])):
                    if load['clusters'][i]['name'] == context:
                        load['clusters'].pop(i)
                        break

                # Save the file
                with io.open(os.environ['HOME'] + '/.kube/config', 'w', encoding='utf8') as out:
                    yaml.safe_dump(load, out, default_flow_style=False, allow_unicode=True)

                self.send({
                    'msgtype': 'deleted-context-successfully',
                })
            except:
                # Handle general exception
                error = "Cannot open KUBECONFIG file"

                self.send({
                    'msgtype': 'deleted-context-unsuccessfully',
                })
        elif action == "create-user":
            # This action adds a remote user to the cluster. Only admins can perform this action.
            error = ''
            username = msg['content']['data']['username']
            email = msg['content']['data']['email']
            selected_context = msg['content']['data']['context']

            # Declaring the naming conventions of the resources to be created or checked
            namespace = 'swan-' + username
            username = username
            rolebinding_name = 'edit-cluster-' + namespace

            try:
                # Load the KUBECONFIG file
                with io.open(os.environ['HOME'] + '/.kube/config', 'r', encoding='utf8') as stream:
                    load = yaml.safe_load(stream)

                for i in load['contexts']:
                    if i['name'] == selected_context:
                        selected_cluster = i['context']['cluster']
                        break

                # Declare all the clients to call kubernetes API
                config.load_kube_config()
                api_instance = client.CoreV1Api()
                rbac_client = client.RbacAuthorizationV1Api()
                flag = 0
                flag1 = 0

                # Check whether the given namespace already exists
                api_response = api_instance.list_namespace()
                for i in api_response.items:
                    if i.metadata.name == namespace:
                        flag = 1
                        break

                if flag == 1:
                    # If the namespace already exists then check whether the given rolebinding
                    # exists.
                    api_response = rbac_client.list_namespaced_role_binding(namespace=namespace)
                    for i in api_response.items:
                        if i.metadata.name == rolebinding_name:
                            # error = 'A user \'{}\' already exists for this cluster'.format(username)
                            flag1 = 1
                            break

                    # If the rolebinding does not exist then create it with clusterrole as 'edit'
                    if flag1 == 0:
                        rolebinding_obj = client.V1ObjectMeta(name=rolebinding_name, namespace=namespace,
                                                              cluster_name=selected_cluster)
                        role_ref = client.V1RoleRef(api_group='rbac.authorization.k8s.io', kind='ClusterRole',
                                                    name='edit')
                        subject = client.V1Subject(api_group='rbac.authorization.k8s.io', kind='User', name=username)
                        subject_list = [subject]
                        rolebinding_body = client.V1RoleBinding(metadata=rolebinding_obj, role_ref=role_ref,
                                                                subjects=subject_list)
                        rbac_client.create_namespaced_role_binding(namespace, rolebinding_body)
                else:
                    # If the namespace does not exist then create the namespace as well as the rolebinding
                    obj = client.V1ObjectMeta(name=namespace, cluster_name=selected_cluster)
                    body = client.V1Namespace(metadata=obj)
                    api_instance.create_namespace(body)

                    rolebinding_obj = client.V1ObjectMeta(name=rolebinding_name, namespace=namespace,
                                                          cluster_name=selected_cluster)
                    role_ref = client.V1RoleRef(api_group='rbac.authorization.k8s.io', kind='ClusterRole', name='edit')
                    subject = client.V1Subject(api_group='rbac.authorization.k8s.io', kind='User', name=username)
                    subject_list = [subject]
                    rolebinding_body = client.V1RoleBinding(metadata=rolebinding_obj, role_ref=role_ref,
                                                            subjects=subject_list)

                    rbac_client.create_namespaced_role_binding(namespace, rolebinding_body)

                # Get the server ip of the cluster to be sent in the email to the user.
                for i in load['clusters']:
                    if i['name'] == selected_cluster:
                        server_ip = i['cluster']['server']
                        ca_cert = i['cluster']['certificate-authority-data']
                        break


                # Load .env file which contains SENDGRID API_KEY
                dotenv_path = join(dirname(__file__), 'sendgrid.env')
                self.log.info(".env PATH: ", dotenv_path)
                # First check for ca_cert and server_ip
                if ca_cert and server_ip:
                    if os.path.isfile(dotenv_path):
                        self.send_sendgrid_email(dotenv_path, email, selected_cluster, ca_cert, server_ip)
                    else:
                        self.send_email(email, selected_cluster, ca_cert, server_ip)
                else:
                    error = 'Cannot get CA-Cert or Server IP of the cluster'
                    self.send({
                        'msgtype': 'added-user-unsuccessfully',
                        'error': error
                    })

                self.send({
                    'msgtype': 'added-user-successfully',
                })
            except:
                # Handle user creation exceptions
                error = 'Cannot create user due to some error.'

                self.send({
                    'msgtype': 'added-user-unsuccessfully',
                    'error': error
                })

    def send_sendgrid_email(self, dotenv_path, email, selected_cluster, ca_cert, server_ip):
        """
        If the admin has sendgrid API credentials, then they can use this function to send email
        :param dotenv_path: path of sendgrid.env file
        :param email: email of the receiver
        :param selected_cluster: the name of cluster that we want to send the info of
        :param ca_cert: ca_cert of the cluster
        :param server_ip: ip of the cluster
        :return:
        """
        try:
            from dotenv import load_dotenv
            from sendgrid import SendGridAPIClient, SendGridException
            from sendgrid.helpers.mail import Mail, To, From

            # Load Sendgrid API key
            load_dotenv(dotenv_path)

            # Create an email message.
            # The 'from_email' is currently hardcoded. It will have to be changed later.
            message = Mail(
                from_email=From('sahil.jajodia@gmail.com'),
                to_emails=To(email),
                subject='Credentials for cluster: ' + selected_cluster,
                html_content='<strong>Cluster name: </strong>' + selected_cluster + '<br><br><strong>CA Cert: </strong>' + ca_cert + '<br><br><strong>Server IP: </strong>' + server_ip)

            # Send the email to the user.
            sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY'))
            response = sg.send(message)
        except ImportError:
            # Handle import exceptions
            error = 'Cannot send email.'

            self.send({
                'msgtype': 'added-user-unsuccessfully',
                'error': error
            })
        except SendGridException as e:
            # Handle sendgrid exceptions
            error = 'Cannot send email.'

            self.send({
                'msgtype': 'added-user-unsuccessfully',
                'error': error
            })

    def send_email(self, email, selected_cluster, ca_cert, server_ip):
        """
        This function can be used to send emails from an internal account at CERN
        :param email: email of the receiver
        :param selected_cluster: the name of cluster that we want to send the info of
        :param ca_cert: ca_cert of the cluster
        :param server_ip: ip of the cluster
        :return:
        """
        try:
            import smtplib

            fromaddr = os.getenv("USER") + "@cern.ch"
            toaddrs = [email]
            msg = '''
                From: {fromaddr}
                To: {toaddr}
                Subject: Credentials for cluster: {selected_cluster}
                Cluster name: {selected_cluster}\n\nCA Cert: {ca_cert}\n\nServer IP: {server_ip} 
            '''

            msg = msg.format(fromaddr=fromaddr, toaddr=toaddrs[0], selected_cluster=selected_cluster, ca_cert=ca_cert, server_ip=server_ip)
            # The actual mail send
            server = smtplib.SMTP('smtp.cern.ch:587')
            server.starttls()
            server.ehlo('swan.cern.ch')
            server.mail(fromaddr)
            server.rcpt(toaddrs[0])
            server.data(msg)
            server.quit()
        except:
            # Handle smtplib exceptions
            error = 'Cannot send email.'

            self.send({
                'msgtype': 'added-user-unsuccessfully',
                'error': error
            })

    def register_comm(self):
        """ Register a comm_target which will be used by frontend to start communication """
        self.ipython.kernel.comm_manager.register_target(
            "K8sSelection", self.target_func)

    def target_func(self, comm, msg):
        """ Callback function to be called when a frontend comm is opened """
        self.log.info("Established connection to frontend")
        self.log.debug("Received message: %s", str(msg))
        self.comm = comm

        @self.comm.on_msg
        def _recv(msg):
            self.handle_comm_message(msg)


        self.cluster_list()

    def cluster_list(self):
        """
        Get the list of contexts and clusters from the KUBECONFIG file and check whether a cluster is reachable and
        the user is an admin of the cluster
        """

        if os.path.isdir(os.getenv('HOME') + '/.kube'):
            if not os.path.isfile(os.getenv('HOME') + '/.kube/config'):
                load = {}
                load['apiVersion'] = 'v1'
                load['clusters'] = []
                load['contexts'] = []
                load['current-context'] = ''
                load['kind'] = 'Config'
                load['preferences'] = {}
                load['users'] = []

                with io.open(os.environ['HOME'] + '/.kube/config', 'w', encoding='utf8') as out:
                    yaml.safe_dump(load, out, default_flow_style=False, allow_unicode=True)
        else:
            os.makedirs(os.getenv('HOME') + '/.kube')

            load = {}
            load['apiVersion'] = 'v1'
            load['clusters'] = []
            load['contexts'] = []
            load['current-context'] = ''
            load['kind'] = 'Config'
            load['preferences'] = {}
            load['users'] = []

            with io.open(os.environ['HOME'] + '/.kube/config', 'w', encoding='utf8') as out:
                yaml.safe_dump(load, out, default_flow_style=False, allow_unicode=True)

        with io.open(os.environ['HOME'] + '/.kube/config', 'r', encoding='utf8') as stream:
            load = yaml.safe_load(stream)

        contexts = load['contexts']
        active_context = ''
        for i in range(len(contexts)):
            if contexts[i]['name'] == load['current-context']:
                active_context = contexts[i]
                break

        clusters = []
        for i in load['clusters']:
            clusters.append(i['name'])


        current_cluster = ''
        for i in load['contexts']:
            if i['name'] == load['current-context']:
                current_cluster = i['context']['cluster']

        namespaces = []
        for i in contexts:
            self.log.info(i)
            if 'namespace' in i['context'].keys():
                namespace = i['context']['namespace']
                namespaces.append(namespace)
            else:
                namespace = 'default'
                namespaces.append(namespace)

        contexts = [context['name'] for context in contexts]
        current_context = ''
        if active_context is not '':
            current_context = active_context['name']

        # Creating two empty lists and looping over the contexts and checking whether the clusters are
        # reachable and if the user is admin of the cluster.
        delete_list = []
        admin_list = []
        for i in range(len(contexts)):
            try:
                self.log.info("TRY")
                config.load_kube_config(context=contexts[i])
                api_instance = client.CoreV1Api()
                api_response = api_instance.list_namespaced_pod(namespace=namespaces[i], timeout_seconds=2)
                delete_list.append("False")
            except:
                self.log.info("EXCEPT")
                delete_list.append("True")


        for i in range(len(contexts)):
            try:
                self.log.info("TRY")
                config.load_kube_config(context=contexts[i])
                api_instance = client.CoreV1Api()
                api_response = api_instance.list_namespaced_pod(namespace='kube-system', timeout_seconds=2)
                admin_list.append("True")
            except:
                self.log.info("EXCEPT")
                admin_list.append("False")

        self.send({
            'msgtype': 'context-select',
            'contexts': contexts,
            'active_context': current_context,
            'clusters': clusters,
            'current_cluster': current_cluster,
            'delete_list': delete_list,
            'admin_list': admin_list,
        })


def load_ipython_extension(ipython):
    """ Load Jupyter kernel extension """

    log = logging.getLogger('tornado.k8sselection.kernelextension')
    log.name = 'k8sselection.kernelextension'
    log.setLevel(logging.INFO)
    log.propagate = True

    if ipykernel_imported:
        if not isinstance(ipython, zmqshell.ZMQInteractiveShell):
            log.error("K8sSelection: Ipython not running through notebook. So exiting.")
            return
    else:
        return

    log.info("Starting K8sSelection Kernel Extension")
    ext = K8sSelection(ipython, log)
    ext.register_comm()