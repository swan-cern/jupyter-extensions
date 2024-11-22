import os, tempfile, time
from threading import Thread


class LogReader(Thread):
    """ Thread to read a file where the logs from Spark are being written """

    def __init__(self, connector, log):
        self.connector = connector
        self.log = log
        self.path = None
        Thread.__init__(self)

    def format_log_line(self, line):
        return line.strip() + "\n"

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