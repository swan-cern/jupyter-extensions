import os, zmq, time, threading, logging
from enum import Enum
import contextlib
from socket import (
    socket,
    SO_REUSEADDR,
    SOL_SOCKET,
    gethostname,
    error as SocketError
)

opened_port_file = '/tmp/port_allocator'


# Use enum with value and use the value throughout the code, in order
# to simplify the pickling of this information
class Conn_State(Enum):
    CONNECTING = "connecting"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"


# Errors pickable to be sent between master and clients
class Errors(Enum):
    NO_PORTS_AVAILABLE = "no_ports_available"


# Actions pickable to be sent between master and clients
class Actions(Enum):
    GET_PORT = "get_port"
    SET_STATUS = "set_status"


class PortsAllocator(threading.Thread):
    """
        Master service that manages all the ports allocated to the session.
        Keeps track of which processes are using them and manages the lifecycle of the ports, in order to
        allow re-utilization of the ports in case of failure or disconnection from a process.
    """

    def __init__(self, log):
        """
            Creates a list of available ports in the session, by reading the SPARK_PORTS env variable,
            that should contain a comma separated list of ports.
            Starts a communication queue in one available internal port, and then listens for incoming
            requests.
        """
        self.ports_available = os.environ.get("SPARK_PORTS", "").split(',')
        self.clients = {}
        self.queue_port = PortsAllocator.get_reserved_port()
        self.log = log

        # Store the queue port so that the clients know where to connect
        with open(opened_port_file, 'w+') as f:
            f.write(str(self.queue_port))

        super(self.__class__, self).__init__()

    def get_ports(self, process, n):
        """
            Return 'n' available ports and assign them to 'process' pid.
            If the 'process' already asked for ports, and the information was not recycled, return the same ports.
            Raises NoPortsException if all ports are in use.
        """

        if process in self.clients:
            ports = self.clients[process]['ports']

            if len(ports) is n:
                self.log.info('Returning same ports for process %s: %s' % (process, ports))
                return ports
            else:
                n = n - len(ports)
        else:
            ports = []

        if len(self.ports_available) < n:
            raise NoPortsException

        ports += self.ports_available[:n]
        del self.ports_available[:n]

        self.clients[process] = {
            'ports': ports,
            'status': Conn_State.CONNECTING.value,
            'time': time.time()
        }

        self.log.info('Requested ports for process %s: %s' % (process, ports))
        return ports

    def delete_client(self, process):
        """ Delete a client from the list of processes and put its ports back in the list so that they're reused """
        if process in self.clients:
            # Put the ports in the end of the list. They will be re-used in last.
            self.ports_available.extend(self.clients[process]['ports'])
            del self.clients[process]
            self.log.info('Deleted process %s' % process)

    def set_status(self, process, status):
        """ Update the status of a client process. Usefull for housekeeping. """
        if process in self.clients:
            self.clients[process]['status'] = status
            self.log.info('Update the status of process %s: %s' % (process, status))

    def _check_process(self, process):
        """ Check if at least one port assigned to this client process is being used. If not, remove the client. """
        s = socket()
        for port in list(self.clients[process]['ports']):
            try:
                s.connect((gethostname(), int(port)))
            except SocketError:
                pass
            else:
                # at least one port is being used, so keep the process info
                self.log.info('Process %s is using at least one requested port' % process)
                break
        else:
            # no port is being used
            self.log.info('Process %s is not using any port' % process)
            self.delete_client(process)
        s.close()

    def check_given_ports_status(self):
        """ 
            Check the status of all registered client process.
            If they're dead or in disconnect state, remove them immediately.
            If they are in connect status, check if they're using any port and remove them if not.
            If they are in the connecting status, do nothing as a timer will clean that process.
        """
        self.log.info('Cleaning status of active processes')

        for process in list(self.clients.keys()):

            if self.clients[process]['status'] == Conn_State.DISCONNECTED.value:
                self.log.info('Process %s is disconnected' % process)
                self.delete_client(process)
                continue

            try:
                os.kill(process, 0)
            except OSError:
                self.log.info('Process %s is no longer alive' % process)
                self.delete_client(process)
                continue

            if self.clients[process]['status'] == Conn_State.CONNECTED.value:
                self._check_process(process)
                continue

            if self.clients[process]['status'] == Conn_State.CONNECTING.value and \
                    self.clients[process]['time'] + 60 < time.time():
                self._check_process(process)

    @staticmethod
    def get_reserved_port():
        """
            Reserve a random available port.
            It puts the door in TIME_WAIT state so that no other process gets it when asking for a random port,
            but allows processes to bind to it, due to the SO_REUSEADDR flag.
            From https://github.com/Yelp/ephemeral-port-reserve
        """
        with contextlib.closing(socket()) as s:
            s.setsockopt(SOL_SOCKET, SO_REUSEADDR, 1)
            s.bind((gethostname(), 0))

            # the connect below deadlocks on kernel >= 4.4.0 unless this arg is greater than zero
            s.listen(1)

            sockname = s.getsockname()

            # these three are necessary just to get the port into a TIME_WAIT state
            with contextlib.closing(socket()) as s2:
                s2.connect(sockname)
                s.accept()
                return sockname[1]

    def run(self):
        """ Main process loop to wait for port requests """
        # Prevent this process from getting killed as, sometimes, the queue gets 
        # in an inconsistent state and needs to be rebuilt.
        # Even if there are no ports, let this process live so that the clients get an 
        # error message stating that there are no available ports.

        while True:
            context = zmq.Context()
            zmq_socket = context.socket(zmq.REP)
            zmq_socket.bind("tcp://*:%s" % self.queue_port)

            def send_msg(kind, content):
                msg = {
                    kind: content
                }
                zmq_socket.send_json(msg)

            def send_ok(content):
                send_msg('ok', content)

            def send_error(content):
                send_msg('error', content)

            try:
                # Listen for clients requests and give them ports.
                while True:
                    try:
                        message = zmq_socket.recv_json()

                        if message['action'] == Actions.GET_PORT.value:

                            # Check the status of given ports to clean them if not in use
                            self.check_given_ports_status()

                            ports = self.get_ports(message['process'], message['n'])
                            send_ok(ports)

                        elif message['action'] == Actions.SET_STATUS.value:
                            self.set_status(message['process'], message['status'])
                            send_ok(message['status'])

                    except NoPortsException:
                        send_error(Errors.NO_PORTS_AVAILABLE.value)
            except zmq.ZMQError:
                pass


class PortsAllocatorClient:
    """
       Proxy to the Ports Allocator process, using a message queue.
       It asks for a number of ports to be allocated to this specific process.
       Port Allocator checks if the ports are in use and, if not, it might give them to
       other processes.
       
    """

    def __init__(self):
        context = zmq.Context()
        self.socket = context.socket(zmq.REQ)
        self.pid = os.getpid()

        # Check which port the message queue is opened
        with open(opened_port_file, 'r') as info_file:
            self.port = info_file.read()

    def connect(self):
        """ 
           Establish a connection with the message queue.
           The connection might be in an inconsistent state and therefore is necessary
           to establish again the connection.
        """
        self.socket.connect("tcp://localhost:%s" % self.port)

    def get_ports(self, n):
        """ 
           Sends a requesting with the number of ports necessary and blocks
           waiting for them or an alternative error message. 
           """
        request_info = {
            'action': Actions.GET_PORT.value,
            'process': self.pid,
            'n': n
        }
        self.socket.send_json(request_info)
        message = self.socket.recv_json()

        if 'ok' in message:
            return message['ok']
        elif message['error'] == Errors.NO_PORTS_AVAILABLE.value:
            raise NoPortsException
        else:
            raise GeneralException

    def _set_status(self, status):
        request_info = {
            'action': Actions.SET_STATUS.value,
            'process': self.pid,
            'status': status
        }
        self.socket.send_json(request_info)
        self.socket.recv_json()

    def set_connected(self):
        """
            Update the status of the ports requested to allow housekeeping.
            If the status is connected, Port Allocator should check if the process is still alive
            and at least one port is being used. Otherwise, remove the allocation.
         """
        self._set_status(Conn_State.CONNECTED.value)


    def set_disconnected(self):
        """
            Update the status of the ports requested to allow housekeeping.
            If the status is disconnected, the allocation should be removed.
        """
        self._set_status(Conn_State.DISCONNECTED.value)


class NoPortsException(BaseException):
    pass


class GeneralException(BaseException):
    pass


def load_jupyter_server_extension(nb_server_app):
    """
    Called when the Jupyter server extension is loaded.

    Args:
        nb_server_app (NotebookWebApplication): handle to the Notebook webserver instance.
    """

    log = logging.getLogger('tornado.sparkconnector.portsallocator')
    log.name = "SparkConnector.PortsAllocator"
    log.setLevel(logging.INFO)
    log.propagate = True

    log.info("Loading Server Extension")

    thread = PortsAllocator(log)
    thread.start()
