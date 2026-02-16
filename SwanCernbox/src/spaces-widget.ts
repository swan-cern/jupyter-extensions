import { Widget } from '@lumino/widgets';
import { FileBrowser } from '@jupyterlab/filebrowser';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { ISpace, fetchSpaces } from './spaces';

/**
 * CSS class names used by the widget.
 * All prefixed with 'swan-spaces-' to avoid collisions.
 */
const CSS = {
  panel: 'swan-spaces-panel',
  header: 'swan-spaces-header',
  headerTitle: 'swan-spaces-header-title',
  refreshBtn: 'swan-spaces-refresh-btn',
  list: 'swan-spaces-list',
  item: 'swan-spaces-item',
  itemActive: 'swan-spaces-item-active',
  itemName: 'swan-spaces-item-name',
  itemDescription: 'swan-spaces-item-description',
  itemPath: 'swan-spaces-item-path',
  loading: 'swan-spaces-loading',
  error: 'swan-spaces-error',
  empty: 'swan-spaces-empty'
} as const;

/**
 * A sidebar widget that displays CERNBox Spaces and navigates
 * the file browser when a space is clicked.
 */
export class SpacesWidget extends Widget {
  private _fileBrowser: FileBrowser;
  private _shell: JupyterFrontEnd.IShell;
  private _listNode: HTMLElement;
  private _spaces: ISpace[] = [];

  constructor(fileBrowser: FileBrowser, shell: JupyterFrontEnd.IShell) {
    super();
    this._fileBrowser = fileBrowser;
    this._shell = shell;
    this.id = 'swan-cernbox-spaces';
    this.title.caption = 'CERNBox Spaces';
    this.addClass(CSS.panel);

    // Build DOM structure
    const header = this._createHeader();
    this._listNode = document.createElement('div');
    this._listNode.className = CSS.list;

    this.node.appendChild(header);
    this.node.appendChild(this._listNode);

    // Load spaces on creation
    this._loadSpaces();
  }

  /**
   * Create the header with title and refresh button.
   */
  private _createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = CSS.header;

    const title = document.createElement('h2');
    title.className = CSS.headerTitle;
    title.textContent = 'CERNBox Spaces';

    const refreshBtn = document.createElement('button');
    refreshBtn.className = CSS.refreshBtn;
    refreshBtn.title = 'Refresh spaces';
    refreshBtn.textContent = '↻';
    refreshBtn.addEventListener('click', () => {
      this._loadSpaces();
    });

    header.appendChild(title);
    header.appendChild(refreshBtn);
    return header;
  }

  /**
   * Fetch spaces and render the list.
   */
  private async _loadSpaces(): Promise<void> {
    this._listNode.innerHTML = '';
    this._showLoading();

    try {
      this._spaces = await fetchSpaces();
      this._renderSpaces();
    } catch (err) {
      this._showError(err instanceof Error ? err.message : 'Failed to load spaces');
    }
  }

  /**
   * Render the list of spaces.
   */
  private _renderSpaces() {
    this._listNode.innerHTML = '';

    if (this._spaces.length === 0) {
      const empty = document.createElement('div');
      empty.className = CSS.empty;
      empty.textContent = 'No spaces available';
      this._listNode.appendChild(empty);
      return;
    }

    for (const space of this._spaces) {
      const item = this._createSpaceItem(space);
      this._listNode.appendChild(item);
    }
  }

  /**
   * Create a DOM element for a single space.
   */
  private _createSpaceItem(space: ISpace): HTMLElement {
    const item = document.createElement('div');
    item.className = CSS.item;
    item.dataset.path = space.path;
    item.title = `Open ${space.name}\n${space.path}`;

    const name = document.createElement('div');
    name.className = CSS.itemName;
    name.textContent = space.name;
    item.appendChild(name);

    if (space.description) {
      const desc = document.createElement('div');
      desc.className = CSS.itemDescription;
      desc.textContent = space.description;
      item.appendChild(desc);
    }

    const path = document.createElement('div');
    path.className = CSS.itemPath;
    path.textContent = space.path;
    item.appendChild(path);

    item.addEventListener('click', () => {
      this._navigateToSpace(space);
    });

    return item;
  }

  /**
   * Navigate the file browser to the given space.
   */
  private async _navigateToSpace(space: ISpace): Promise<void> {
    try {
      await this._fileBrowser.model.cd(space.path);
      // Switch to the file browser tab in the sidebar
      this._shell.activateById(this._fileBrowser.id);
    } catch (err) {
      console.error(`[swan-cern/swancernbox:spaces] Failed to navigate to ${space.path}:`, err);
    }
  }

  private _showLoading() {
    const el = document.createElement('div');
    el.className = CSS.loading;
    el.textContent = 'Loading spaces…';
    this._listNode.appendChild(el);
  }

  private _showError(message: string) {
    this._listNode.innerHTML = '';
    const el = document.createElement('div');
    el.className = CSS.error;
    el.textContent = message;
    this._listNode.appendChild(el);
  }
}
