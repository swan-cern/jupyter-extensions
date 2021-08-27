import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IThemeManager } from '@jupyterlab/apputils';

/**
 * Initialization data for the @swan-cern/themedark extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: '@swan-cern/themedark',
  requires: [IThemeManager],
  autoStart: true,
  activate: (app: JupyterFrontEnd, manager: IThemeManager) => {
    console.log('JupyterLab extension @swan-cern/themedark is activated!');
    const style = '@swan-cern/themedark/index.css';

    manager.register({
      name: 'SWAN Dark',
      isLight: false,
      load: () => manager.loadCSS(style),
      unload: () => Promise.resolve(undefined)
    });
  }
};

export default extension;
