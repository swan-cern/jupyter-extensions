// Copyright (c) SWAN Development Team.
// Author: Omar.Zapata@cern.ch 2021

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, IThemeManager } from '@jupyterlab/apputils';
import { swanProjectIcon } from './icons';

const PALETTE_CATEGORY = 'Project';

import { ProjectDialog } from './ProjectDialog';

/**
 * The command IDs used by the server extension plugin.
 */
namespace CommandIDs {
  export const projectDialog = 'swan:create-project-dialog';
  export const projectDialogEdit = 'swan:edit-project-dialog';
}

import { ILauncher } from '@jupyterlab/launcher';
import { kernelsInfoRequest } from './request';

import { IMainMenu } from '@jupyterlab/mainmenu';

/**
 * Initialization data for the server-extension-example extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'swanprojects',
  autoStart: true,
  optional: [],
  requires: [ICommandPalette, ILauncher, IThemeManager, IMainMenu],
  activate: async (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    launcher: ILauncher,
    themeManager: IThemeManager,
    mainMenu: IMainMenu
  ) => {
    console.log('JupyterLab extension swanprojects is activated!');

    let theme: 'light' | 'dark' = 'light';
    if (themeManager) {
      if (themeManager.theme && themeManager.isLight(themeManager.theme)) {
        theme = 'light';
      } else {
        theme = 'dark';
      }
      themeManager.themeChanged.connect((_, args) => {
        if (themeManager.isLight(args.newValue)) {
          theme = 'light';
        } else {
          theme = 'dark';
        }
      });
    }

    const { commands } = app;

    commands.addCommand(CommandIDs.projectDialog, {
      icon: swanProjectIcon,
      label: 'New Project',
      caption: 'New Project',
      execute: async args => {
        const stacks = await kernelsInfoRequest();
        ProjectDialog.OpenModal(
          {
            name: '',
            stack: '',
            release: '',
            platform: '',
            user_script: '',
            stacks_options: stacks['stacks']
          },
          true,
          commands,
          theme
        );
      }
    });

    commands.addCommand(CommandIDs.projectDialogEdit, {
      icon: swanProjectIcon,
      label: 'Edit',
      caption: 'Edit',
      execute: async args => {
        const stacks = await kernelsInfoRequest();
        ProjectDialog.OpenModal(
          {
            name: args.name as string,
            stack: args.stack as string,
            release: args.release as string,
            platform: args.platform as string,
            user_script: args.user_script as string,
            stacks_options: stacks['stacks'],
            corrupted: args.corrupted as boolean
          },
          false,
          commands,
          theme
        );
      }
    });

    // Add the command to the launcher
    if (launcher) {
      launcher.add({
        command: CommandIDs.projectDialog,
        category: PALETTE_CATEGORY,
        rank: 1,
        kernelIconUrl: ''
      });
    }

    // // Add the command to the palette
    if (palette) {
      palette.addItem({
        command: CommandIDs.projectDialog,
        args: { isPalette: true },
        category: PALETTE_CATEGORY
      });
    }
    const command = CommandIDs.projectDialog;
    app.contextMenu.addItem({
      command: command,
      rank: 0,
      selector: '.jp-DirListing-content'
    });

    if (mainMenu) {
      mainMenu.fileMenu.newMenu.addGroup([{ command: command }], 0);
    }
  }
};

export default extension;
