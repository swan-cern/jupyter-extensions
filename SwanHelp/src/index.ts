import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

const extension: JupyterFrontEndPlugin<void> = {
  id: '@swan-cern/swanhelp',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension swanhelp is activated!');
  }
};

export default extension;
