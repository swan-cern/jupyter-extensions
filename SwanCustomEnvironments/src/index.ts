import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the swancustomenvironments extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'swancustomenvironments:plugin',
  description: 'Extension to provide support for custom environments',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension swancustomenvironments is activated!');
  }
};

export default plugin;
