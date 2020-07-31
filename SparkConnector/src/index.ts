import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the testextensions extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'sparkconnector',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension sparkconnector is activated!');
  }
};

export default extension;
