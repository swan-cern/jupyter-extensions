import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ConfigWithDefaults, ConfigSection } from '@jupyterlab/services';
import { Dialog, IFrame, MainAreaWidget, ICommandPalette } from '@jupyterlab/apputils';
import { IMainMenu } from '@jupyterlab/mainmenu';
import { ILauncher } from '@jupyterlab/launcher';
import { showAboutDialog, showLoadingSpinnerDialog } from './dialog';
import { swanGalleryIcon } from './icons';
import { downloadUrlFromServer } from './gallery-download-helper';
import { showDialog } from "@jupyterlab/apputils";

function registerGalleryListener(app: JupyterFrontEnd, galleryUrl: string) {
  window.addEventListener('message', async (event: any) => {
    if (event.origin != galleryUrl) {
      console.error(`SwanGallery: Failed to validate origin, message from ${event.origin} does not match ${galleryUrl} . Skipping downloading URL`);
      return;
    }
    const dialog = showLoadingSpinnerDialog();
    try {
      const response = await downloadUrlFromServer(event.data);

      app.commands.execute('filebrowser:open-path', {
        path: response.path,
        showBrowser: false
      });
      dialog.reject();
    } catch (error) {
      dialog.reject();
      showDialog({ title: "Failed to download notebook", buttons: [Dialog.okButton()] });
      console.error(
        `Failed to download notebook.\n ${error}`
      );
    }
  });
}

const defaultConfigs = {
  help: "https://swan.docs.cern.ch/",
  community: "https://cern.ch/swan-community",
  support: "https://cern.service-now.com/service-portal/function.do?name=swan",
  gallery: "https://swan-gallery.web.cern.ch"
}

namespace CommandIDs {
  export const about = 'swanhelp:about';
  export const help = 'swanhelp:help';
  export const community = 'swanhelp:community';
  export const support = 'swanhelp:support';
  export const gallery = 'swanhelp:gallery';
  export const galleryLauncher = 'swanhelp:gallery_launcher';
}

async function activate(
  app: JupyterFrontEnd,
  mainMenu: IMainMenu,
  palette: ICommandPalette,
  launcher: ILauncher
): Promise<void> {
  console.log('JupyterLab extension SwanHelp is activated!');

  // Load the config from the server but set the default values.
  // The config contains the urls for each button, in case we need to overwrite them
  // (for ScinceBox for example).
  let section = await ConfigSection.create({ name: 'help' });
  let config = new ConfigWithDefaults({
    section,
    defaults: defaultConfigs,
    className: 'SwanHelp'
  });

  // Create a group of SWAN buttons
  const helpMenu = mainMenu.helpMenu;
  const swanGroup = [
    CommandIDs.about,
    CommandIDs.help,
    CommandIDs.gallery,
    CommandIDs.community,
    CommandIDs.support,
  ].map(command => ({ command }));
  helpMenu.addGroup(swanGroup, -1); //Put first in the list

  // Add the buttons names and actions to the menu

  app.commands.addCommand(CommandIDs.about, {
    label: `About SWAN`,
    execute: () => showAboutDialog()
  });

  let helpUrl = config.get('help') as string;
  if (helpUrl !== '') {
    app.commands.addCommand(CommandIDs.help, {
      label: "Help",
      execute: () => {
        return newIframeWidget(helpUrl, "Help");
      }
    });
  }

  let galleryUrl = config.get('gallery') as string;

  if (galleryUrl !== '') {
    registerGalleryListener(app, galleryUrl)
    const commandGallery = {
      label: 'Examples Gallery',
      execute: () => {
        return newIframeWidget(galleryUrl, "Gallery");
      }
    }
    app.commands.addCommand(CommandIDs.gallery, commandGallery);
    app.commands.addCommand(CommandIDs.galleryLauncher, {
      ...commandGallery,
      icon: swanGalleryIcon
    });

    palette.addItem({ command: CommandIDs.gallery, category: 'SWAN' });
  
    if (launcher) {
      launcher.add({
        command: CommandIDs.galleryLauncher,
        category: 'Other',
        rank: 3
      });
    }
  }
  
  let communityUrl = config.get('community') as string;
  if (communityUrl !== '') {
    app.commands.addCommand(CommandIDs.community, {
      label: 'Community',
      execute: () => {
        window.open(communityUrl);
      }
    });
  }
  
  let supportUrl = config.get('support') as string;
  if (supportUrl !== '') {
    app.commands.addCommand(CommandIDs.support, {
      label: 'Support',
      execute: () => {
        window.open(supportUrl);
      }
    });
  }

  // Open the link inside an iFrame
  function newIframeWidget(url: string, text: string): MainAreaWidget<IFrame> {
    // Allow for search functionality and animations.
    let content = new IFrame({
      sandbox: ['allow-scripts',
        'allow-forms',
        'allow-same-origin',
        'allow-modals',
        'allow-downloads', // Required to download notebooks
        'allow-popups' // Required for opening external links in new tabs
      ]
    });
    content.url = url;
    content.title.label = text;
    let widget = new MainAreaWidget({ content });
    widget.addClass('jp-Help');
    app.shell.add(widget, 'main');
    return widget;
  }
}

const extension: JupyterFrontEndPlugin<void> = {
  id: '@swan-cern/swanhelp:plugin',
  requires: [IMainMenu, ICommandPalette, ILauncher],
  autoStart: true,
  activate: activate
};

export default extension;