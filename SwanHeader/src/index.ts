import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import React from 'react';

import { ReactWidget } from '@jupyterlab/apputils';
import { Header } from './header';

const plugin: JupyterFrontEndPlugin<void> = {
  id: '@swan-cern/header:plugin',
  description: 'SWAN JupyterLab Header Bar',
  autoStart: true,
  requires: [JupyterFrontEnd.IPaths],
  activate: (app: JupyterFrontEnd, paths: JupyterFrontEnd.IPaths) => {
    console.log('JupyterLab extension @swan-cern/header is activated!');
    const headerWidget = ReactWidget.create(
      React.createElement(Header, {
        hubPrefix: paths.urls.hubPrefix,
        hubUser: paths.urls.hubUser,
        baseUrl: paths.urls.base
      })
    );
    headerWidget.id = 'swan-header';

    app.shell.add(headerWidget, 'header');
  }
};

export default plugin;
