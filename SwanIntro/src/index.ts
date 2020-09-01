import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the testextensions extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'swanintro',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension swanintro is activated!');
  }
};

export default extension;
