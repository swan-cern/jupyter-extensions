import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the testextensions extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'swannotifications',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension swannotifications is activated!');
  }
};

export default extension;
