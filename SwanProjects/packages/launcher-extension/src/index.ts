// Copyright (c) SWAN Development Team.
// Auhtor: Omar.Zapata@cern.ch 2021, modified from original launcher.

import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';
import { ILauncher, LauncherModel } from '@jupyterlab/launcher';
import { SWANLauncher } from './launcher';
import { launcherIcon } from '@jupyterlab/ui-components';

import { toArray } from '@lumino/algorithm';
import { ReadonlyPartialJSONObject } from '@lumino/coreutils';
import { Widget } from '@lumino/widgets';

/**
 * The command IDs used by the launcher plugin.
 */
namespace CommandIDs {
  export const create_launcher = 'launcher:create';
  export const create_project = 'swan:create_project';
  export const import_project = 'swan:import_project';
}

/**
 * A service providing an interface to the the launcher.
 */
const plugin: JupyterFrontEndPlugin<ILauncher> = {
  activate,
  id: '@swan/launcher-project:plugin',
  requires: [ILabShell],
  optional: [ICommandPalette],
  provides: ILauncher,
  autoStart: true
};

/**
 * Export the plugin as default.
 */
export { SWANLauncher };
export default plugin;
/**
 * Activate the launcher.
 */
function activate(
  app: JupyterFrontEnd,
  labShell: ILabShell,
  palette: ICommandPalette | null
): ILauncher {
  console.log('JupyterLab extension swanlauncher is activated!');
  const { serviceManager, commands } = app;
  const model = new LauncherModel();
  let launcher = null;
  commands.addCommand(CommandIDs.create_launcher, {
    icon: launcherIcon,
    label: 'SWAN Launcher',
    execute: (args: ReadonlyPartialJSONObject) => {
      const cwd = args['cwd'] ? String(args['cwd']) : '';
      const id = `swan-launcher-${Private.id++}`;
      const callback = (item: Widget) => {
        labShell.add(item, 'main', { ref: id });
      };

      launcher = new SWANLauncher({ model, cwd, callback, commands });

      launcher.model = model;
      launcher.service_manager = serviceManager;
      launcher.title.icon = launcherIcon;
      launcher.title.label = 'SWAN Launcher';
      const main = new MainAreaWidget({ content: launcher });

      // If there are any other widgets open, remove the launcher close icon.
      main.title.closable = !!toArray(labShell.widgets('main')).length;
      main.id = id;
      labShell.add(main, 'main', { activate: args['activate'] as boolean });

      labShell.layoutModified.connect(() => {
        // If there is only a launcher open, remove the close icon.
        main.title.closable = toArray(labShell.widgets('main')).length > 1;
      }, main);
      if (palette) {
        palette.addItem({
          command: CommandIDs.create_launcher,
          category: 'SWAN'
        });
      }

      return main;
    }
  });

  if (palette) {
    palette.addItem({
      command: CommandIDs.create_launcher,
      category: 'Launcher'
    });
  }

  return model;
}

/**
 * The namespace for module private data.
 */
namespace Private {
  /**
   * The incrementing id used for launcher widgets.
   */
  export let id = 0; // eslint-disable-line 
}
