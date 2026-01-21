// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
/**
 * @packageDocumentation
 * @module launcher
 */


// This file is forked from @jupytlab/launcher v3.4.0
// See https://github.com/jupyterlab/jupyterlab/blob/2b1a963e545b445b0debe9ab86979866b42c84b3/packages/launcher/src/index.tsx#L1
// changes from upstream behaviour are commented with a tag EDIT

import { showErrorMessage, VDomRenderer } from '@jupyterlab/apputils';
import {
  ITranslator,
  nullTranslator,
  TranslationBundle
} from '@jupyterlab/translation';
import { classes, LabIcon } from '@jupyterlab/ui-components';
import { map, each, toArray } from '@lumino/algorithm';
import { CommandRegistry } from '@lumino/commands';
import { AttachedProperty } from '@lumino/properties';
import { Widget } from '@lumino/widgets';
import * as React from 'react';

import { ILauncher, LauncherModel } from '@jupyterlab/launcher';

import { Spinner } from '@jupyterlab/apputils';
import { ProjectHeader } from './components/project-header';
import { SwanProjectsPlugin } from './project-plugin';
import { ProjectData } from './types';

/**
 * The class name added to Launcher instances.
 */
const LAUNCHER_CLASS = 'jp-Launcher';

/**
 * A virtual-DOM-based widget for the Launcher.
 */
export class SWANLauncher extends VDomRenderer<LauncherModel> {
  project?: ProjectData | null; // EDIT
  private isProjectAllowedInPath: boolean = false; // EDIT

  /**
   * Construct a new launcher widget.
   */
  constructor(
    options: ILauncher.IOptions,
    private projectsPlugin: SwanProjectsPlugin // EDIT
  ) {
    super(options.model);
    this.model = options.model;
    this._cwd = options.cwd;
    this.translator = options.translator || nullTranslator;
    this._trans = this.translator.load('jupyterlab');
    this._callback = options.callback;
    this._commands = options.commands;
    this.addClass(LAUNCHER_CLASS);

    // EDIT
    this._spinner = new Spinner();

    this.fetchProjectDetails();
  }

  protected startSpinner(): void {
    const node = this.node;
    node?.appendChild(this._spinner.node);
    node?.focus();
    this._spinner.activate();
    this._spinner.show();
    this._spinner.node.focus();
  }

  protected stopSpinner(): void {
    this._spinner.hide();
  }

  async refresh() {
    await this.fetchProjectDetails();
  }

  /**
   * The cwd of the launcher.
   */
  get cwd(): string {
    return this._cwd;
  }

  set cwd(value: string) {
    this._cwd = value;
    this.update();

    // EDIT
    this.fetchProjectDetails();
  }

  /**
   * Whether there is a pending item being launched.
   */
  get pending(): boolean {
    return this._pending;
  }
  set pending(value: boolean) {
    this._pending = value;
  }

  async fetchProjectDetails(): Promise<void> {
    this.startSpinner();

    const { project, isProjectAllowedInPath } =
      await this.projectsPlugin.getProjectForPath(this.cwd);
    this.isProjectAllowedInPath = isProjectAllowedInPath;
    this.project = project;

    this.stopSpinner();
    if (this.isAttached) {
      this.update();
    }
  }

  /**
   * Render the launcher to virtual DOM nodes.
   */
  protected render(): React.ReactElement<any> | null {
    // Bail if there is no model.
    if (!this.model) {
      return null;
    }

    const knownCategories = [
      this._trans.__('Notebook'),
      this._trans.__('Console'),
      this._trans.__('Other')
    ];
    const kernelCategories = [
      this._trans.__('Notebook'),
      this._trans.__('Console')
    ];

    // First group-by categories
    const categories = Object.create(null);
    each(this.model.items(), (item, index) => {
      const cat = item.category || 'Other';
      //const args = item.args;

      if (!(cat in categories)) {
        categories[cat] = [];
      }
      categories[cat].push(item);
    });
    // Within each category sort by rank
    for (const cat in categories) {
      categories[cat] = categories[cat].sort(
        (a: ILauncher.IItemOptions, b: ILauncher.IItemOptions) => {
          return Private.sortCmp(a, b, this._cwd, this._commands);
        }
      );
    }

    // Variable to help create sections
    const sections: React.ReactElement<any>[] = [];
    let section: React.ReactElement<any>;

    // Assemble the final ordered list of categories, beginning with
    // KNOWN_CATEGORIES.
    const orderedCategories: string[] = [];
    each(knownCategories, (cat, index) => {
      orderedCategories.push(cat);
    });
    for (const cat in categories) {
      if (knownCategories.indexOf(cat) === -1) {
        orderedCategories.push(cat);
      }
    }

    // Now create the sections for each category
    orderedCategories.forEach(cat => {
      let item = null;
      if (categories[cat]) {
        item = categories[cat][0] as ILauncher.IItemOptions;
      }
      if (item === null) {
        return;
      }
      if (item.command === 'terminal:create-new') {
        item.args = { initialCommand: '' };
      }
      const args = { ...item.args, cwd: this.cwd };
      const kernel = kernelCategories.indexOf(cat) > -1;

      // DEPRECATED: remove _icon when lumino 2.0 is adopted
      // if icon is aliasing iconClass, don't use it

      const iconClass = this._commands.iconClass(item.command, args);
      const _icon = this._commands.icon(item.command, args);
      let icon = _icon === iconClass ? undefined : _icon;

      if (cat in categories) {
        section = (
          <div className="jp-Launcher-section" key={cat}>
            <div className="jp-Launcher-sectionHeader">
              <LabIcon.resolveReact
                icon={icon}
                iconClass={classes(iconClass, 'jp-Icon-cover')}
                stylesheet="launcherSection"
              />
              <h2 className="jp-Launcher-sectionTitle">{cat}</h2>
            </div>
            <div className="jp-Launcher-cardContainer">
              {toArray(
                map(categories[cat], (item: ILauncher.IItemOptions) => {
                  return Card(
                    kernel,
                    item,
                    this,
                    this._commands,
                    this._callback
                  );
                })
              )}
            </div>
          </div>
        );
        sections.push(section);
      }
    });

    // Wrap the sections in body and content divs.
    return (
      <div className="jp-Launcher-body">
        <div className="jp-Launcher-content">
          <ProjectHeader
            cwd={this.cwd}
            project={this.project}
            isProjectAllowedInPath={this.isProjectAllowedInPath}
            onClickChangeStack={() => {
              this.projectsPlugin.showProjectDialog(
                this.cwd,
                this.project || undefined
              );
            }}
          />
          <div className="jp-Launcher-cwd"></div>
          {sections}
        </div>
      </div>
    );
  }

  protected translator: ITranslator;
  private _trans: TranslationBundle;
  private _commands: CommandRegistry;
  private _callback: (widget: Widget) => void;
  private _pending = false;
  private _cwd = '';
  private _spinner: Spinner; // EDIT
}

/**
 * A pure tsx component for a launcher card.
 *
 * @param kernel - whether the item takes uses a kernel.
 *
 * @param item - the launcher item to render.
 *
 * @param launcher - the Launcher instance to which this is added.
 *
 * @param launcherCallback - a callback to call after an item has been launched.
 *
 * @returns a vdom `VirtualElement` for the launcher card.
 */
export function Card(
  kernel: boolean,
  item: ILauncher.IItemOptions,
  launcher: any,
  commands: CommandRegistry,
  launcherCallback: (widget: Widget) => void
): React.ReactElement<any> {
  // Get some properties of the command
  const command = item.command;
  const args = { ...item.args, cwd: launcher.cwd };
  const caption = commands.caption(command, args);
  const label = commands.label(command, args);
  const title = kernel ? label : caption || label;

  // Build the onclick handler.
  const onclick = () => {
    // If an item has already been launched,
    // don't try to launch another.
    if (launcher.pending === true) {
      return;
    }
    launcher.pending = true;
    void commands
      .execute(command, {
        ...item.args,
        cwd: launcher.cwd
      })
      .then(value => {
        launcher.pending = false;
        if (value instanceof Widget) {
          launcherCallback(value);
          launcher.dispose();
        }
      })
      .catch(err => {
        launcher.pending = false;
        void showErrorMessage('Launcher Error', err);
      });
  };

  // With tabindex working, you can now pick a kernel by tabbing around and
  // pressing Enter.
  const onkeypress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      onclick();
    }
  };

  // DEPRECATED: remove _icon when lumino 2.0 is adopted
  // if icon is aliasing iconClass, don't use it
  const iconClass = commands.iconClass(command, args);
  const _icon = commands.icon(command, args);
  const icon = _icon === iconClass ? undefined : _icon;

  // Return the VDOM element.
  return (
    <div
      className="jp-LauncherCard"
      title={title}
      onClick={onclick}
      onKeyPress={onkeypress}
      tabIndex={100}
      data-category={item.category || 'Other'}
      key={Private.keyProperty.get(item)}
    >
      <div className="jp-LauncherCard-icon">
        {kernel ? (
          item.kernelIconUrl ? (
            <img src={item.kernelIconUrl} className="jp-Launcher-kernelIcon" />
          ) : (
            <div className="jp-LauncherCard-noKernelIcon">
              {label[0].toUpperCase()}
            </div>
          )
        ) : (
          <LabIcon.resolveReact
            icon={icon}
            iconClass={classes(iconClass, 'jp-Icon-cover')}
            stylesheet="launcherCard"
          />
        )}
      </div>
      <div className="jp-LauncherCard-label" title={title}>
        <p>{label}</p>
      </div>
    </div>
  );
}

/**
 * The namespace for module private data.
 */
namespace Private {
  /**
   * An incrementing counter for keys.
   */
  let id = 0;

  /**
   * An attached property for an item's key.
   */
  export const keyProperty = new AttachedProperty<
    ILauncher.IItemOptions,
    number
  >({
    name: 'key',
    create: () => id++
  });

  /**
   * Create a fully specified item given item options.
   */
  export function createItem(
    options: ILauncher.IItemOptions
  ): ILauncher.IItemOptions {
    return {
      ...options,
      category: options.category || '',
      rank: options.rank !== undefined ? options.rank : Infinity
    };
  }

  /**
   * A sort comparison function for a launcher item.
   */
  export function sortCmp(
    a: ILauncher.IItemOptions,
    b: ILauncher.IItemOptions,
    cwd: string,
    commands: CommandRegistry
  ): number {
    // First, compare by rank.
    const r1 = a.rank;
    const r2 = b.rank;
    if (r1 !== r2 && r1 !== undefined && r2 !== undefined) {
      return r1 < r2 ? -1 : 1; // Infinity safe
    }

    // Finally, compare by display name.
    const aLabel = commands.label(a.command, { ...a.args, cwd });
    const bLabel = commands.label(b.command, { ...b.args, cwd });
    return aLabel.localeCompare(bLabel);
  }
}
