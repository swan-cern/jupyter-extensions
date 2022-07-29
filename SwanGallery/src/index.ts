import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { requestAPI } from './handler';

import { ICommandPalette} from '@jupyterlab/apputils';

import { IFrame, MainAreaWidget} from '@jupyterlab/apputils';

 async function activate(
  app: JupyterFrontEnd,
  palette: ICommandPalette
):Promise<void> {
  console.log('JupyterLab extension SwanGallery is activated!');

  const command: string = 'swangallery:open';
  app.commands.addCommand(command, {
    label: `SwanGallery`,
    execute: () => 
    { 
      let content = new IFrame({
        sandbox: ['allow-scripts', 'allow-forms', 'allow-same-origin', 'allow-modals', 'allow-downloads']
      });

      window.addEventListener('message', event => {

        requestAPI<any>('notebook')
        .then(data => {
          //console.log(data);
          app.commands.execute('filebrowser:open-path', {
            path: data.path,
            showBrowser: false,
          });
        })
        .catch(reason => {
          console.error(
            `The SwanGallery server extension appears to be missing.\n${reason}`
          );
        });
      });

      content.url = "http://127.0.0.1:8080/test.html";
      content.title.label = "SwanGallery";
      let widget = new MainAreaWidget({ content });
      widget.id = 'swan-gallery';
      widget.title.closable = true;
      app.shell.add(widget, 'main');
      app.shell.activateById(widget.id);
    }
  });

  palette.addItem({ command, category: 'Tutorial' });
}

const extension: JupyterFrontEndPlugin<void> = {
  id: 'SwanTest:plugin',
  requires: [ICommandPalette],
  autoStart: true,
  activate: activate
};

export default extension;
