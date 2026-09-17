// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module launcher-extension
 */

// This file is forked from @jupytlab/launcher v3.4.0
// See https://github.com/jupyterlab/jupyterlab/blob/2b1a963e545b445b0debe9ab86979866b42c84b3/packages/launcher-extension/src/index.ts#L7
// changes from upstream behaviour are commented with a tag EDIT

import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';
import { ILauncher, LauncherModel } from '@jupyterlab/launcher';
import { ITranslator } from '@jupyterlab/translation';
import { launcherIcon } from '@jupyterlab/ui-components';
import { toArray } from '@lumino/algorithm';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { SWANLauncher } from './launcher';
import { DockPanel, TabBar, Widget } from '@lumino/widgets';

import { SwanProjectsPlugin, SwanProjectsToken } from './project-plugin'; // EDIT
namespace CommandIDs {
  export const create = 'launcher:create';
  export const refresh = 'launcher:refresh'; // EDIT
}

const plugin: JupyterFrontEndPlugin<ILauncher> = {
  activate,
  id: '@swan/launcher-project:plugin',
  requires: [ITranslator, ILabShell, SwanProjectsToken],
  optional: [ICommandPalette],
  provides: ILauncher,
  autoStart: true
};

/**
 * Export the plugin as default.
 */
export default plugin;

/**
 * Activate the launcher.
 */
function activate(
  app: JupyterFrontEnd,
  translator: ITranslator,
  labShell: ILabShell,
  projects: SwanProjectsPlugin, // EDIT
  palette: ICommandPalette | null
): ILauncher {
  const { commands, shell } = app;
  const trans = translator.load('jupyterlab');
  const model = new LauncherModel();
  const allLaunchers: SWANLauncher[] = [];

  commands.addCommand(CommandIDs.create, {
    icon: launcherIcon,
    label: 'New Launcher',
    execute: (args: ReadonlyPartialJSONObject) => {
      const cwd = args['cwd'] ? String(args['cwd']) : '';
      const id = `launcher-${Private.id++}`;
      const callback = (item: Widget) => {
        shell.add(item, 'main', { ref: id });
      };

      const launcher = new SWANLauncher(
        {
          model,
          cwd,
          callback,
          commands,
          translator
        },
        projects // EDIT
      );

      allLaunchers.push(launcher);

      launcher.model = model;
      launcher.title.icon = launcherIcon;
      launcher.title.label = trans.__('Launcher');

      const main = new MainAreaWidget({ content: launcher });

      // If there are any other widgets open, remove the launcher close icon.
      main.title.closable = !!toArray(shell.widgets('main')).length;
      main.id = id;
      shell.add(main, 'main', { activate: args['activate'] as boolean });

      if (labShell) {
        labShell.layoutModified.connect(() => {
          // If there is only a launcher open, remove the close icon.
          main.title.closable = toArray(labShell.widgets('main')).length > 1;
        }, main);
      }

      return main;
    }
  });

  if (palette) {
    palette.addItem({
      command: CommandIDs.create,
      category: trans.__('Launcher')
    });
  }

  if (labShell) {
    labShell.addButtonEnabled = true;
    labShell.addRequested.connect((sender: DockPanel, arg: TabBar<Widget>) => {
      // Get the ref for the current tab of the tabbar which the add button was clicked
      const ref =
        arg.currentTitle?.owner.id ||
        arg.titles[arg.titles.length - 1].owner.id;
      if (commands.hasCommand('filebrowser:create-main-launcher')) {
        // If a file browser is defined connect the launcher to it
        return commands.execute('filebrowser:create-main-launcher', { ref });
      }
      return commands.execute(CommandIDs.create, { ref });
    });
  }

  app.commands.addCommand(CommandIDs.refresh, {
    execute: (args: ReadonlyPartialJSONObject) => {
      allLaunchers.forEach(launcher => {
        if (!launcher.isDisposed) {
          launcher?.refresh();
        }
      });
    }
  });

  return model;
}

/**
 * The namespace for module private data.
 */
namespace Private {
  /**
   * The incrementing id used for launcher widgets.
   */
  export let id = 0;
}
