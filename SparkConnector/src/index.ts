import {
  ILabShell,
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ReactWidget, IThemeManager } from '@jupyterlab/apputils';
import { LabIcon } from '@jupyterlab/ui-components';
import React from 'react';

import { store } from './store';
import { LazySparkConnectorPanel } from './components/lazy-panel';
import { JupyterLabConnector } from './labconnector';
import SparkIcon from '../style/apachespark.svg';

/**
 * Initialization data for the @swan-cern/sparkconnector extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: '@swan-cern/sparkconnector:plugin',
  description: "Helper to connect to CERN's Spark Clusters",
  requires: [ILabShell, INotebookTracker, ILayoutRestorer],
  optional: [IThemeManager],
  activate: activate,
  autoStart: true,
};

export default plugin;

/**
 * Activate the running plugin.
 */
function activate(
  app: JupyterFrontEnd,
  labShell: ILabShell,
  notebooks: INotebookTracker,
  restorer: ILayoutRestorer,
  themeManager: IThemeManager
): void {
  const appConnector = new JupyterLabConnector(app, notebooks);
  store.setAppConnector(appConnector);

  const panelWidget = ReactWidget.create(
    React.createElement(LazySparkConnectorPanel)
  );

  panelWidget.id = 'spark-connector';
  panelWidget.title.caption = 'Apache Spark';
  panelWidget.title.icon = new LabIcon({
    name: 'sparkconnector:sparkicon',
    svgstr: SparkIcon,
  });

  labShell.add(panelWidget, 'right', {
    rank: 700,
  });

  if (themeManager) {
    if (themeManager.theme && themeManager.isLight(themeManager.theme)) {
      store.colorTheme = 'light';
    } else {
      store.colorTheme = 'dark';
    }
    themeManager.themeChanged.connect((_, args) => {
      if (themeManager.isLight(args.newValue)) {
        store.colorTheme = 'light';
      } else {
        store.colorTheme = 'dark';
      }
    });
  }
  console.log('JupyterLab extension @swan-cern/sparkconnector is activated!');
}
