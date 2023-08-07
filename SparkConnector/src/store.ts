import { makeAutoObservable } from 'mobx';
import type { JupyterLabConnector } from './labconnector';

let uniqueId = 0;

type OptionType = {
  value: string;
  data: {
    category: string;
  };
};

type BundleType = {
  options: Array<{
    name: string;
    concatenate?: string;
    value: string;
  }>;
  cluster_filter: string[];
  spark_version_filter: string[];
};

/*
  An observable MobX store. 

  React components wrapped with observer() are automatically re-rendered 
  when the store data is changed.

  All updates to the store must either be methods on this class or 
  be wrapped in action(). See MobX documentation for details.
*/
class SparkConnectorStore {
  colorTheme: 'dark' | 'light' = 'light';
  notebooks: { [index: string]: NotebookStateStore } = {};
  allAvailableBundles: { [bundleName: string]: BundleType } = {};
  availableOptions: OptionType[] = [];
  currentNotebookPanelId: string | null = null;
  appConnector?: JupyterLabConnector;
  constructor() {
    makeAutoObservable(this);
  }

  setAppConnector(connector: JupyterLabConnector) {
    this.appConnector = connector;
  }

  updateConfigurationFromServer(sparkOptionsData: any, bundleData: any) {
    this.allAvailableBundles = bundleData.bundled_options || {};

    const sparkOptions: OptionType[] = sparkOptionsData?.spark_options || [];
    // Sort the options alphabetically based on category
    // for auto-complete to work
    sparkOptions.sort((a, b) => {
      return a.data.category.localeCompare(b.data.category);
    });
    this.availableOptions = sparkOptions;
  }

  /*
    Computed/Derived values from the state
  */

  get currentNotebook() {
    return this.notebooks[this.currentNotebookPanelId as string];
  }

  /* 
    Actions that modify the state
  */

  createNotebookState(
    notebookPanelId: string,
    options: {
      title: string;
    }
  ) {
    const notebookState = new NotebookStateStore();
    notebookState.title = options.title;
    notebookState.status = 'notattached';
    this.notebooks[notebookPanelId] = notebookState;
    this.currentNotebookPanelId = notebookPanelId;
  }

  setActiveNotebook(notebookPanelId: string | null) {
    this.currentNotebookPanelId = notebookPanelId;
  }

  deleteNotebookState(notebookPanelId: string) {
    delete this.notebooks[notebookPanelId];
    if ((this.currentNotebookPanelId = notebookPanelId)) {
      this.currentNotebookPanelId = null;
    }
  }

  setNotebookConfig(
    notebookPanelId: string,
    options: {
      maxMemory: string;
      sparkVersion: string;
      clusterName: string;
      savedConfig: any;
    }
  ) {
    this.notebooks[notebookPanelId].clusterName = options.clusterName;
    this.notebooks[notebookPanelId].sparkVersion = options.sparkVersion;
    this.notebooks[notebookPanelId].maxMemory = options.maxMemory;
    this.notebooks[notebookPanelId].selectedConfigurations = [];
    this.notebooks[notebookPanelId].selectedBundles = [];
    options?.savedConfig?.bundled_options.forEach((bundleName: string) => {
      // Ignore any bundles not in our current configuration and not available for the selected cluster/session
      if (
        this.allAvailableBundles[bundleName] &&
        this.notebooks[notebookPanelId].filteredAvailableBundles[bundleName]
      ) {
        this.notebooks[notebookPanelId].selectedBundles.push(bundleName);
      }
    });
    options?.savedConfig?.list_of_options?.forEach((config: any) => {
      this.notebooks[notebookPanelId].selectedConfigurations.push({
        id: `${++uniqueId}`,
        name: config.name,
        value: config.value,
        isEnabled: config.isEnabled !== undefined ? config.isEnabled : true,
      });
    });
  }

  appendConnectionLog(notebookPanelId: string, message: string) {
    this.notebooks[notebookPanelId as string].logs.push(message);
  }

  updateLogs(notebookPanelId: string, logs: string[]) {
    this.notebooks[notebookPanelId].logs = logs;
  }

  onClickConnect() {
    if (!this.currentNotebookPanelId) {
      throw Error(
        'SparkConnector: Inconsistent state. Attempting to connect with no active notebook.'
      );
    }
    console.log(
      'SparkConnector: Connecting to Spark',
      this.currentNotebook.optionsToSendToKernel
    );
    store.currentNotebook.status = 'connecting';
    store.currentNotebook.logs = ['Waiting for spark context to start'];
    const notebookMetadata = {
      bundled_options: store.currentNotebook.selectedBundles,
      list_of_options: store.currentNotebook.selectedConfigurations.map(
        (c) => ({
          name: c.name,
          value: c.value,
        })
      ),
    };

    this.appConnector?.saveCurrentConfigToNotebookMetadata(
      this.currentNotebookPanelId,
      notebookMetadata
    );

    this.appConnector?.onClickConnect(
      this.currentNotebookPanelId,
      this.currentNotebook.optionsToSendToKernel
    );
  }

  onClickAuthenticate(password: string) {
    this.currentNotebook.status = 'loading';
    store.currentNotebook.authError = undefined;
    this.appConnector?.onClickAuthenticate(
      this.currentNotebookPanelId as string,
      password
    );
  }

  onClickRestart() {
    this.appConnector?.onClickRestart(store.currentNotebookPanelId as string);
  }

  onRefreshLogs() {
    this.appConnector?.onRefreshLogs(this.currentNotebookPanelId as string);
  }
}

class NotebookStateStore {
  title?: string;
  maxMemory?: string;
  sparkVersion?: string;
  clusterName?: string;
  authError?: string;

  status:
    | 'connected'
    | 'auth'
    | 'connecting'
    | 'error'
    | 'loading'
    | 'configuring'
    | 'notattached' = 'configuring';
  selectedConfigurations: Array<{
    id: string;
    name: string;
    value: string;
    isEnabled: boolean;
  }> = [];
  selectedBundles: Array<string> = [];
  errorMessage?: string;
  connectionResources?: {
    sparkWebuiUrl?: string;
    sparkMetricsUrl?: string;
    logs?: string[];
  };
  logs: string[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  get filteredAvailableBundles() {
    const filteredBundles: { [bundleName: string]: BundleType } = {};

    Object.keys(store.allAvailableBundles).forEach((bundleName) => {
      const bundle = store.allAvailableBundles[bundleName];
      const isNotEnabledForCluster =
        bundle.cluster_filter &&
        bundle.cluster_filter.length !== 0 &&
        !bundle.cluster_filter.includes(this.clusterName as string);
      const isNotEnabledForSparkVersion =
        bundle.spark_version_filter &&
        bundle.spark_version_filter.length !== 0 &&
        !bundle.spark_version_filter.includes(this.sparkVersion as string);
      if (!(isNotEnabledForCluster || isNotEnabledForSparkVersion)) {
        filteredBundles[bundleName] = bundle;
      }
    });

    return filteredBundles;
  }

  get optionsToSendToKernel() {
    const options = {} as { [configName: string]: string };

    this.selectedConfigurations.forEach((configuration) => {
      if (configuration.isEnabled) {
        options[configuration.name] = configuration.value;
      }
    });

    // here the bundles are merged with the user configurations:
    // - if key in bundle does not exist already, it is created
    // - if it exists already, we check the "concatenate" value:
    //   - if it exists, we use it to concatenate to the existing conf,
    //   - otherwise we don't add it: the choices of the user have higher priority
    this.selectedBundles.forEach((bundleName: string) => {
      this.filteredAvailableBundles[bundleName].options.forEach(
        (bundleOption) => {
          if (bundleOption['name'] in options) {
            if (
              bundleOption['concatenate'] &&
              bundleOption['concatenate'] !== ''
            ) {
              options[bundleOption['name']] =
                options[bundleOption['name']] +
                bundleOption['concatenate'] +
                bundleOption['value'];
            } //else we don't add it
          } else {
            //we create the new option
            options[bundleOption['name']] = bundleOption['value'];
          }
        }
      );
    });
    return options;
  }

  addConfiguration(name: string, value: string) {
    this.selectedConfigurations.push({
      id: `${++uniqueId}`,
      name,
      value,
      isEnabled: true,
    });
  }

  removeConfiguration(id: string) {
    const index = this.selectedConfigurations.findIndex((c) => c.id === id);
    if (index > -1) {
      this.selectedConfigurations.splice(index, 1);
    }
  }

  addBundle(bundleName: string) {
    this.selectedBundles.push(bundleName);
  }

  removeBundle(bundleName: string) {
    const index = this.selectedBundles.indexOf(bundleName);
    if (index > -1) {
      this.selectedBundles.splice(index, 1);
    }
  }
}
export const store = new SparkConnectorStore();

// For debugging
(window as any).sparkConnectorStore = store;
