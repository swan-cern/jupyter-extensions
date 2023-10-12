import { runInAction } from 'mobx';

import { JupyterFrontEnd } from '@jupyterlab/application';
import { IComm } from '@jupyterlab/services/lib/kernel/kernel';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { KernelMessage, ConfigSection } from '@jupyterlab/services';
import { JSONObject } from '@lumino/coreutils';

import { store } from './store';
export interface SparkOpt {
  name: string;
  value: string;
}

export interface SparkconnectMetadata {
  bundled_options: Array<string>;
  list_of_options: Array<SparkOpt>;
}
const SPARKCONNECTOR_COMM_TARGET = 'SparkConnector';

/*
  Jupyterlab specific integration.
*/
export class JupyterLabConnector {
  /*
    Mapping between notebookPanel Ids to Comm objects
    opened in the kernel for that object.
  */
  private comms: Map<string, IComm> = new Map();

  constructor(
    private labApp: JupyterFrontEnd,
    private notebookTracker: INotebookTracker
  ) {
    this.initConfigurationFromServer();
    this.initStateHandling();
  }

  private async initConfigurationFromServer() {
    const availableOptionConfigSection = await ConfigSection.create({
      name: 'sparkconnector_spark_options',
    });
    const bundlesConfigSection = await ConfigSection.create({
      name: 'sparkconnector_bundles',
    });
    store.updateConfigurationFromServer(
      availableOptionConfigSection.data,
      bundlesConfigSection.data
    );
  }

  private getNotebookPanel(notebookPanelId: string) {
    const notebookPanel = this.notebookTracker.find(
      (nb) => nb.id === notebookPanelId
    );
    if (!notebookPanel) {
      throw new Error('SparkConnector: Notebook Panel does not exist');
    }
    return notebookPanel;
  }

  private createComm(notebookPanel: NotebookPanel) {
    const kernel = notebookPanel.sessionContext.session?.kernel;
    if (!kernel) {
      throw new Error(
        'SparkConnector: Trying to create comm when kernel/session is null'
      );
    }
    console.log(
      'SparkConnector: CREATE COMM for ',
      notebookPanel.title.label,
      kernel.id
    );
    const comm = kernel.createComm(SPARKCONNECTOR_COMM_TARGET);
    this.comms.set(notebookPanel.id, comm);
    comm.open({
      type: 'action',
      action: 'sparkconn-action-open',
    });
    comm.onClose = () => {
      this.comms.delete(notebookPanel.id);
      runInAction(() => {
        store.notebooks[notebookPanel.id].status = 'notattached';
      });
      console.log('SparkConnector: Comm closed:', notebookPanel.title.label);
    };
    comm.onMsg = (msg: KernelMessage.ICommMsgMsg) => {
      this.handleCommMessage(msg, notebookPanel);
    };
  }

  private async trackNotebook(notebookPanel: NotebookPanel) {
    if (!store.notebooks[notebookPanel.id]) {
      // If we don't already have a stored state for this notebook:
      store.createNotebookState(notebookPanel.id, {
        title: notebookPanel.title.label,
      });
    }
    // Ensure the state of the jupyterlab kernel/session object is synced with API
    await notebookPanel.sessionContext.ready;

    // Connect to kernel on first page load
    if (!this.comms.has(notebookPanel.id)) {
      try {
        this.createComm(notebookPanel);
      } catch (e) {
        console.error('SparkConnector: Error creating comm');
      }
    }

    // Connect to kernel when a restarting etc.
    // The statusChanged.connect is no-op if already connected.
    notebookPanel.sessionContext.statusChanged.connect((_, status) => {
      switch (status) {
        case 'restarting':
        case 'terminating':
        case 'autorestarting':
        case 'dead':
        case 'unknown':
          this.comms.delete(notebookPanel.id);
          runInAction(() => {
            store.notebooks[notebookPanel.id].status = 'notattached';
          });
          break;
        case 'starting':
          if (!this.comms.has(notebookPanel.id)) {
            try {
              this.createComm(notebookPanel);
            } catch (e) {
              console.error('SparkConnector: Error creating comm');
            }
          }
          break;
      }
    }, this);
  }

  private initStateHandling(): void {
    this.notebookTracker.widgetAdded.connect((_, notebookPanel) => {
      this.trackNotebook(notebookPanel);
    });

    this.notebookTracker.currentChanged.connect((_, notebookPanel) => {
      if (!notebookPanel) {
        // There is no notebook panel selected
        store.setActiveNotebook(null);
      } else {
        store.setActiveNotebook(notebookPanel.id);
      }
    });
  }

  /*
    Handle messages from the Kernel extension.
  */
  private handleCommMessage(
    message: KernelMessage.ICommMsgMsg,
    notebookPanel: NotebookPanel
  ) {
    runInAction(() => {
      const data: any = message.content.data;
      switch (data.msgtype) {
        case 'sparkconn-action-open': {
          const page = message.content.data.page;
          const savedConfig =
            this.getSavedConfigFromNotebookMetadata(notebookPanel);
          store.setNotebookConfig(notebookPanel.id, {
            maxMemory: data.maxmemory as string,
            sparkVersion: data.sparkversion as string,
            clusterName: data.cluster as string,
            savedConfig,
          });
          if (page === 'sparkconn-config') {
            store.notebooks[notebookPanel.id].status = 'configuring';
          } else if (page === 'sparkconn-auth') {
            store.notebooks[notebookPanel.id].status = 'auth';
          } else if (page === 'sparkconn-connected') {
            // The kernel sends this page when a comm is opened, but the
            // user is already connected. It subsequently also sends a msgtype: sparkconn-connected,
            // so we don't do anything here
          } else {
            console.log('SparkConnector: Unknown page from server');
          }
          break;
        }
        case 'sparkconn-connected': {
          store.notebooks[notebookPanel.id].connectionResources = {
            sparkWebuiUrl: data.config.sparkwebui as string,
            sparkMetricsUrl: data.config.sparkmetrics as string,
          };
          store.notebooks[notebookPanel.id].status = 'connected';
          break;
        }
        case 'sparkconn-config': {
          // Sent by kernel on successful authentication
          store.notebooks[notebookPanel.id].status = 'configuring';
          break;
        }
        case 'sparkconn-auth': {
          store.notebooks[notebookPanel.id].status = 'auth';
          store.notebooks[notebookPanel.id].authError = data.error as string;
          break;
        }
        case 'sparkconn-connect-error': {
          store.notebooks[notebookPanel.id].errorMessage = data.error as string;
          store.notebooks[notebookPanel.id].status = 'error';
          break;
        }
        case 'sparkconn-action-follow-log': {
          store.appendConnectionLog(notebookPanel.id, data.msg as string);
          break;
        }
        case 'sparkconn-action-tail-log': {
          store.updateLogs(notebookPanel.id, data.msg as string[]);
          break;
        }
        default:
          console.error(
            'SparkConnector: Received an unknown msgtype from kernel:',
            message
          );
          break;
      }
    });
  }

  onClickAuthenticate(notebookPanelId: string, password: string) {
    const comm = this.comms.get(notebookPanelId);
    if (comm) {
      comm.send({
        action: 'sparkconn-action-auth',
        password,
      });
    }
  }

  onClickConnect(
    notebookPanelId: string,
    options: { [configName: string]: string }
  ) {
    const comm = this.comms.get(notebookPanelId);
    if (comm) {
      comm.send({
        action: 'sparkconn-action-connect',
        options,
      });
    }
  }

  private async promptUserForKernelRestart(notebookPanelId: string) {
    return this.labApp.commands.execute('notebook:restart-kernel');
  }

  async onClickRestart(notebookPanelId: string) {
    // Restart the kernel, because SparkContexts are cached,
    // we need to restart to do a clean retry again
    const isRestarted = await this.promptUserForKernelRestart(notebookPanelId);
    if (isRestarted) {
      const comm = this.comms.get(notebookPanelId);
      if (comm) {
        comm.send({
          action: 'sparkconn-action-disconnect',
        });
      }
    }
  }

  onRefreshLogs(notebookPanelId: string) {
    const comm = this.comms.get(notebookPanelId);
    if (comm) {
      comm.send({
        action: 'sparkconn-action-getlogs',
      });
    }
  }

  private getSavedConfigFromNotebookMetadata(notebookPanel: NotebookPanel) {
    let currentConfig;
    const metadata = (notebookPanel.model?.metadata || {}) as JSONObject
    if (metadata.sparkconnect) {
      currentConfig = metadata.sparkconnect as unknown as SparkconnectMetadata;
    } else {
      currentConfig = {
        bundled_options: [],
        list_of_options: [],
      } as SparkconnectMetadata;
    }

    // TODO silently remove any bundles that are not in the current set.
    return currentConfig;
  }

  saveCurrentConfigToNotebookMetadata(
    notebookPanelId: string,
    config: SparkconnectMetadata
  ) {
    const notebookPanel = this.getNotebookPanel(notebookPanelId);
    const metadata = (notebookPanel.model?.metadata || {}) as JSONObject
    metadata.sparkconnect = config as any;
  }
}
