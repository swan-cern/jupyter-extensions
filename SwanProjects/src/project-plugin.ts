import { Token } from '@lumino/coreutils';

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, IThemeManager } from '@jupyterlab/apputils';

import {
  editProjectRequest,
  getAvailableSoftwareStacksRequest,
  getProjectRequest
} from './requests';
import { ISWANStackOptions, ProjectData } from './types';
import { ProjectDialog } from './project-dialog';

export class SwanProjectsPlugin {
  private availableSoftwareStacks?: ISWANStackOptions;
  private projectDialog: ProjectDialog;

  constructor(private jupyterApp: JupyterFrontEnd) {
    this.projectDialog = new ProjectDialog(this);
  }

  async changeLauncherPath(path: string) {
    return await this.jupyterApp.commands.execute('launcher:refresh');
  }

  async getAvailableSoftwareStacks() {
    if (this.availableSoftwareStacks) {
      return this.availableSoftwareStacks.stacks;
    }
    this.availableSoftwareStacks = await getAvailableSoftwareStacksRequest();
    return this.availableSoftwareStacks!.stacks;
  }

  async getProjectForPath(path: string): Promise<any> {
    const { project, isProjectAllowedInPath } = await getProjectRequest(path);
    return { project, isProjectAllowedInPath };
  }

  showProjectDialog(path: string, project?: ProjectData) {
    this.projectDialog.showEditProjectDialog(path, project);
  }

  async editProject(
    path: string,
    project: {
      stack: any;
      user_script: string;
    }
  ) {
    return await editProjectRequest(path, project);
  }
}

export const SwanProjectsToken: Token<SwanProjectsPlugin> =
  new Token<SwanProjectsPlugin>('SwanProjects');

const plugin: JupyterFrontEndPlugin<SwanProjectsPlugin> = {
  activate,
  id: '@swan/projects:plugin',
  requires: [],
  optional: [ICommandPalette, IThemeManager],
  provides: SwanProjectsToken,
  autoStart: true
};

async function activate(app: JupyterFrontEnd, palette: ICommandPalette | null) {
  const projects = new SwanProjectsPlugin(app);
  return projects;
}

export default plugin;
