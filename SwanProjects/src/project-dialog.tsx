import React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';

import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';

import { ThemeProvider } from './components/theme-provider';
import { ProjectData } from './types';
import { SwanProjectsPlugin } from './project-plugin';
import { ProjectForm } from './project-form';

export class ProjectDialog extends ReactWidget {
  private theme: 'light' | 'dark' = 'light';
  private stacks?: any;
  private project?: ProjectData;
  private path?: string;
  private errorMessage = '';
  private isLoading = true;
  private isLoadingFormSubmit = false;

  constructor(private projectsPlugin: SwanProjectsPlugin) {
    super();
    this.loadSoftwareStacks();
  }

  private async loadSoftwareStacks() {
    this.isLoading = true;
    this.stacks = await this.projectsPlugin.getAvailableSoftwareStacks();
    this.isLoading = false;
    if (this.isAttached) {
      this.update();
    }
  }

  private async onSubmitDialog(args: any) {
    this.isLoadingFormSubmit = true;
    this.update();
    const result = await this.projectsPlugin.editProject(this.path!, args);
    if (!result.status) {
      this.errorMessage = result.errorMessage;
      this.isLoadingFormSubmit = false;
      this.update();
    }
    if (result.status) {
      this.isLoadingFormSubmit = false;
      await this.projectsPlugin.changeLauncherPath(this.path!);
      Widget.detach(this);
    }
  }

  public async showEditProjectDialog(path: string, project?: ProjectData) {
    this.path = path;
    this.project = project;
    this.errorMessage = '';
    if (this.isAttached) {
      Widget.detach(this);
    }
    Widget.attach(this, document.body);
  }

  public render() {
    return (
      <ThemeProvider theme={this.theme || 'light'}>
        <Dialog open fullWidth maxWidth="sm">
          <DialogContent>
            {this.isLoading ? (
              <div>Loading</div>
            ) : (
              <ProjectForm
                isLoading={this.isLoadingFormSubmit}
                path={this.path!}
                errorMessage={this.errorMessage}
                availableStacks={this.stacks!}
                project={this.project}
                onSubmit={(args: any) => {
                  this.onSubmitDialog(args);
                }}
                onCancel={() => {
                  Widget.detach(this);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </ThemeProvider>
    );
  }
}
