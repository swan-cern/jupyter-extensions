import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ConfigWithDefaults, ConfigSection } from '@jupyterlab/services';
import { IFrame, MainAreaWidget } from '@jupyterlab/apputils';
import { IMainMenu } from '@jupyterlab/mainmenu';
import swanDialog from './dialog';

const defaultConfigs = {
  help: "https://swan.docs.cern.ch/",
  community: "https://cern.ch/swan-community",
  support: "https://cern.service-now.com/service-portal/function.do?name=swan",
  gallery: "https://cern.ch/swan-gallery"
}

const extension: JupyterFrontEndPlugin<void> = {
  id: '@swan-cern/swanhelp:plugin',
  requires: [IMainMenu],
  autoStart: true,
  activate: activate
};

export default extension;

namespace CommandIDs {
  export const about = 'swanhelp:about';
  export const help = 'swanhelp:help';
  export const community = 'swanhelp:community';
  export const support = 'swanhelp:support';
  export const gallery = 'swanhelp:gallery';
}

async function activate(
  app: JupyterFrontEnd,
  mainMenu: IMainMenu
):Promise<void> {

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
    execute: () => swanDialog()
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
    app.commands.addCommand(CommandIDs.gallery, {
      label: 'Examples Gallery',
      execute: () => {
        return newIframeWidget(galleryUrl, "Gallery");
      }
    });
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
      sandbox: ['allow-scripts', 'allow-forms', 'allow-same-origin']
    });
    content.url = url;
    // content.addClass(HELP_CLASS);
    content.title.label = text;
    // content.id = `${namespace}-${++counter}`;
    let widget = new MainAreaWidget({ content });
    widget.addClass('jp-Help');
    app.shell.add(widget, 'main');
    return widget;
  }

  return;
}
