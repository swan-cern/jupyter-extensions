import { ILabShell, JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { IDefaultFileBrowser } from '@jupyterlab/filebrowser';
import { spacesIcon, shareIcon } from './icons';
import { SpacesWidget } from './spaces-widget';
import { SharesWidget } from './shares-widget';
import { attachQuotaIndicator } from './quota-widget';

/**
 * The Shares plugin.
 *
 * Adds a sidebar panel showing CERNBox folders shared with and by
 * the user. Clicking a share navigates the default file browser
 * to the corresponding EOS path.
 */
const sharesPlugin: JupyterFrontEndPlugin<void> = {
  id: '@swan-cern/swancernbox:shares',
  description: 'Browse CERNBox shared folders from the JupyterLab sidebar',
  autoStart: true,
  requires: [IDefaultFileBrowser],
  optional: [ILabShell],
  activate: (app: JupyterFrontEnd, fileBrowser: IDefaultFileBrowser, labShell: ILabShell | null) => {
    console.log('[swan-cern/swancernbox] Activating shares plugin');

    const widget = new SharesWidget(fileBrowser, app.shell);
    widget.title.icon = shareIcon;

    if (labShell) {
      labShell.add(widget, 'left', { rank: 120 });
    } else {
      app.shell.add(widget, 'left');
    }
  }
};

/**
 * The Spaces plugin.
 *
 * Adds a sidebar panel that lists CERNBox Spaces (projects) the user
 * has access to. Clicking a space navigates the default file browser
 * to the corresponding EOS path.
 */
const spacesPlugin: JupyterFrontEndPlugin<void> = {
  id: '@swan-cern/swancernbox:spaces',
  description: 'Navigate CERNBox Spaces from the JupyterLab sidebar',
  autoStart: true,
  requires: [IDefaultFileBrowser],
  optional: [ILabShell],
  activate: (app: JupyterFrontEnd, fileBrowser: IDefaultFileBrowser, labShell: ILabShell | null) => {
    console.log('[swan-cern/swancernbox] Activating spaces plugin');

    const widget = new SpacesWidget(fileBrowser, app.shell);
    widget.title.icon = spacesIcon;

    if (labShell) {
      labShell.add(widget, 'left', { rank: 121 });
    } else {
      app.shell.add(widget, 'left');
    }
  }
};

/**
 * The Storage Quota plugin.
 *
 * Attaches a progress bar to the bottom of the default file browser
 * showing the user's CERNBox storage usage.
 */
const quotaPlugin: JupyterFrontEndPlugin<void> = {
  id: '@swan-cern/swancernbox:quota',
  description: 'CERNBox storage quota indicator in the file browser',
  autoStart: true,
  requires: [IDefaultFileBrowser],
  activate: (app: JupyterFrontEnd, fileBrowser: IDefaultFileBrowser) => {
    console.log('[swan-cern/swancernbox] Activating quota plugin');
    attachQuotaIndicator(fileBrowser);
  }
};

export default [sharesPlugin, spacesPlugin, quotaPlugin];
