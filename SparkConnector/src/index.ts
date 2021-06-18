import {
  ILabShell,
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { ReactWidget, IThemeManager } from '@jupyterlab/apputils';
import React from 'react';

import { store } from './store';
import { LazySparkConnectorPanel } from './components/lazy-panel';
import { JupyterLabConnector } from './labconnector';

/**
 * Initialization data for the sparkconnector extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'sparkconnector',
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
  panelWidget.title.iconClass = 'jp-SparkConnector-icon jp-SideBar-tabIcon';
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
  console.log('SparkConnector: Jupyter Lab extension is activated!');
}
