import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { downloadUrlFromServer } from './handler';

import { Dialog, ICommandPalette } from '@jupyterlab/apputils';

import { IFrame, MainAreaWidget } from '@jupyterlab/apputils';
import { ILauncher } from '@jupyterlab/launcher';
import { swanGalleryIcon } from './icons';

import { showDialog } from "@jupyterlab/apputils";
import { ConfigSection } from '@jupyterlab/services';

/*
  Fetch URL of the gallery website from the jupyter server config
*/
async function initConfigurationFromServer() {
  const galleryUrl = await ConfigSection.create({
    name: 'gallery',
  });
  return galleryUrl.data?.gallery_url as string;
}

async function activate(
  app: JupyterFrontEnd,
  palette: ICommandPalette,
  launcher: ILauncher
): Promise<void> {
  console.log('JupyterLab extension SwanGallery is activated!');
  
  const galleryUrl = await initConfigurationFromServer();
  
  let flag = true;
  const command = 'swangallery:open';
  app.commands.addCommand(command, {
    label: 'SWAN Gallery',
    icon: swanGalleryIcon,
    execute: () => {
      const content = new IFrame({
        sandbox: [
          'allow-scripts',
          'allow-same-origin',
          'allow-modals',
          'allow-downloads', // Required to download notebooks
          'allow-popups' // Required for opening external links in new tabs
        ]
      });

      // Avoid multiple executes of the same event
      if (flag === true) {
        flag = false;
        window.addEventListener('message', async (event: any) => {
          if (event.origin != galleryUrl) {
            console.error(`SwanGallery: Failed to validate origin, message from ${event.origin} does not match ${galleryUrl} . Skipping downloading URL`);
            return;
          }
          try {
            const response = await downloadUrlFromServer(event.data);

            app.commands.execute('filebrowser:open-path', {
              path: response.path,
              showBrowser: false
            });

          } catch (error) {
            showDialog({ title: "Failed to download notebook", buttons: [Dialog.okButton()] });
            console.error(
              `The SwanGallery server extension appears to be missing.\n ${error}`
            );
          }
        });
      }

      content.url = galleryUrl;
      content.title.label = 'SWAN Gallery';
      const widget = new MainAreaWidget({ content });
      widget.id = 'swan-gallery';
      widget.title.closable = true;
      app.shell.add(widget, 'main');
      app.shell.activateById(widget.id);
    }
  });

  palette.addItem({ command, category: 'SWAN' });

  if (launcher) {
    launcher.add({
      command: command,
      category: 'Other',
      rank: 1
    });
  }
}

const extension: JupyterFrontEndPlugin<void> = {
  id: 'swangallery',
  requires: [ICommandPalette, ILauncher],
  autoStart: true,
  activate: activate
};

export default extension;
