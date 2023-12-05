// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';

import { ICommandPalette, IToolbarWidgetRegistry } from '@jupyterlab/apputils';

import { PageConfig, URLExt } from '@jupyterlab/coreutils';

import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';

import { ITranslator } from '@jupyterlab/translation';

import { Menu, MenuBar, Widget } from '@lumino/widgets';

import {
  defaultNotebookPathOpener,
  INotebookPathOpener,
} from '@jupyter-notebook/application';

import {
  caretDownIcon,
  CommandToolbarButton,
  launchIcon,
} from '@jupyterlab/ui-components';

/**
 * The command IDs used by the application plugin.
 */
namespace CommandIDs {
  /**
   * Launch Jupyter Notebook Tree
   */
  export const launchNotebookTree = 'swanclassic:launch-tree';

  /**
   * Open Jupyter Notebook
   */
  export const openNotebook = 'swanclassic:open-notebook';
}

interface ISwitcherChoice {
  command: string;
  commandLabel: string;
  commandDescription: string;
  buttonLabel: string;
  urlPrefix: string;
}

/**
 * A plugin to add custom toolbar items to the notebook page
 */
const interfaceSwitcher: JupyterFrontEndPlugin<void> = {
  id: '@swanclassic/lab-extension:interface-switcher',
  description: 'A plugin to add custom toolbar items to the notebook page.',
  autoStart: true,
  requires: [ITranslator, INotebookTracker],
  optional: [
    ICommandPalette,
    INotebookPathOpener,
    IToolbarWidgetRegistry,
  ],
  activate: (
    app: JupyterFrontEnd,
    translator: ITranslator,
    notebookTracker: INotebookTracker,
    palette: ICommandPalette | null,
    notebookPathOpener: INotebookPathOpener | null,
    toolbarRegistry: IToolbarWidgetRegistry | null
  ) => {
    const { commands, shell } = app;
    const baseUrl = PageConfig.getBaseUrl();
    const trans = translator.load('notebook');
    const switcher = new Menu({ commands });
    const switcherOptions: ISwitcherChoice[] = [];
    const opener = notebookPathOpener ?? defaultNotebookPathOpener;


    switcherOptions.push({
      command: CommandIDs.openNotebook,
      commandLabel: trans.__('Classic UI'),
      commandDescription: trans.__('Open in %1', 'Old UI'),
      buttonLabel: 'openNotebook',
      urlPrefix: `${baseUrl}notebooks`,
    });

    const isEnabled = () => {
      return (
        notebookTracker.currentWidget !== null &&
        notebookTracker.currentWidget === shell.currentWidget
      );
    };

    const addSwitcherCommand = (option: ISwitcherChoice) => {
      const { command, commandLabel, commandDescription, urlPrefix } = option;

      const execute = () => {
        const current = notebookTracker.currentWidget;
        if (!current) {
          return;
        }
        opener.open({
          prefix: urlPrefix,
          path: current.context.path,
        });
      };

      commands.addCommand(command, {
        label: (args) => {
          args.noLabel ? '' : commandLabel;
          if (args.isMenu || args.isPalette) {
            return commandDescription;
          }
          return commandLabel;
        },
        caption: commandLabel,
        execute,
        isEnabled,
      });

      if (palette) {
        palette.addItem({
          command,
          category: 'Other',
          args: { isPalette: true },
        });
      }
    };

    switcherOptions.forEach((option) => {
      const { command } = option;
      addSwitcherCommand(option);
      switcher.addItem({ command });
    });

    let toolbarFactory: (panel: NotebookPanel) => Widget;
    if (switcherOptions.length === 1) {
      toolbarFactory = (panel: NotebookPanel) => {
        const toolbarButton = new CommandToolbarButton({
          commands,
          id: switcherOptions[0].command,
          label: switcherOptions[0].commandLabel,
          icon: launchIcon,
        });
        toolbarButton.addClass('jp-nb-interface-switcher-button');
        return toolbarButton;
      };
    } else {
      const overflowOptions = {
        overflowMenuOptions: { isVisible: false },
      };
      const menubar = new MenuBar(overflowOptions);
      switcher.title.label = trans.__('Open in...');
      switcher.title.icon = caretDownIcon;
      menubar.addMenu(switcher);

      toolbarFactory = (panel: NotebookPanel) => {
        const menubar = new MenuBar(overflowOptions);
        menubar.addMenu(switcher);
        menubar.addClass('jp-InterfaceSwitcher');
        return menubar;
      };
    }

    if (toolbarRegistry) {
      toolbarRegistry.addFactory<NotebookPanel>(
        'Notebook',
        'interfaceSwitcher',
        toolbarFactory
      );
    }
  },
};

/**
 * A plugin to add a command to open the Jupyter Notebook Tree.
 */
const launchNotebookTree: JupyterFrontEndPlugin<void> = {
  id: '@swanclassic/lab-extension:launch-tree',
  description: 'A plugin to add a command to open the Jupyter Notebook Tree.',
  autoStart: true,
  requires: [ITranslator, ICommandPalette],
  optional: [],
  activate: (
    app: JupyterFrontEnd,
    translator: ITranslator,
    palette: ICommandPalette
  ): void => {
    const { commands } = app;
    const trans = translator.load('notebook');
    const category = trans.__('Help');

    commands.addCommand(CommandIDs.launchNotebookTree, {
      label: trans.__('Launch the Classic SWAN UI'),
      execute: () => {
        const url = URLExt.join(PageConfig.getBaseUrl(), 'projects');
        window.open(url);
      },
    });

    palette.addItem({ command: CommandIDs.launchNotebookTree, category });
  },
};

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [
  launchNotebookTree,
  interfaceSwitcher,
];

export default plugins;
