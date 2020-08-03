import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the testextensions extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'sparkmonitor',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension sparkmonitor is activated!');
  }
};

export default extension;
