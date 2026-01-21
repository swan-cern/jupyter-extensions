// Copyright (c) SWAN Team.
// Author: Omar Zapata CERN 2021

/**
 * ProjectDialog is a modal dialog that allows to create and edit projects,
 * the dialog allows to select the stack, release, platform and write in a textbox
 * a bash script to run inside the project.
 *
 * If the .swanproject file is corrupted, this dialog will appear
 * for the user to enter the right information about the project again.
 */

import { showErrorMessage } from '@jupyterlab/apputils';
import { showDialog } from './dialog';
import { createProjectRequest, editProjectRequest } from './request';
import { Spinner } from '@jupyterlab/apputils';
import { CommandRegistry } from '@lumino/commands';
/**
 * Namespace for project dialogs
 */
export namespace ProjectDialog {
  export interface ISWANStackNodeOptions {
    releases: { [release: string]: Array<string> };
    logo: string;
  }

  export interface ISWANStackOptions {
    stacks_options?: { [stack: string]: ISWANStackNodeOptions };
  }

  export interface ISWANOptions {
    name?: string;
    stack?: string;
    release?: string;
    platform?: string;
    user_script?: string;
    corrupted?: boolean;
  }

  /**
   * variables from backend response
   */
  export interface ISWANReqResponse {
    status: boolean;
    project_dir: string;
    msg: string;
  }

  /**
   * Create and show a modal dialog to create or modify projects.
   *
   * @param options - The dialog setup options.
   * @param isNewProject - true for a new project, false to modify.
   * @param commands - CommandRegistry object
   * @param theme - colors in the interface 'light' | 'dark'.
   * @returns A promise that resolves with the dialog results
   */
  // eslint-disable-next-line  no-inner-declarations
  export async function OpenModal(
    options: ISWANOptions,
    stacks: ISWANStackOptions,
    isNewProject: boolean,
    commands: CommandRegistry,
    theme: 'light' | 'dark'
  ): Promise<any> {
    const _spinner = new Spinner();
    const old_options = Object.assign({}, options);

    function startSpinner(): void {
      /**
       * Function to start the spinner in the SwanLauncer, embed in the html tag with id jp-main-dock-panel.
       */
      const node = document.getElementById('jp-main-dock-panel');
      node?.appendChild(_spinner.node);
      node?.focus();
      _spinner.activate();
      _spinner.show();
      _spinner.node.focus();
    }

    /**
     * hides the spinner from the component
     */
    function stopSpinner(): void {
      _spinner.hide();
    }

    async function editProject(
      old_options: ISWANOptions,
      options: ISWANOptions
    ): Promise<void> {
      await editProjectRequest(old_options, options)
        .then(async (res: ISWANReqResponse) => {
          if (res.status) {
            await commands
              .execute('filebrowser:go-to-path', {
                path: res.project_dir,
                showBrowser: false,
              })
              .catch((msg: any) => {
                stopSpinner();
                showErrorMessage(
                  'Error opening project: ' + old_options.name,
                  'It is not prossible go to the edited project folder.'
                );
                console.log(msg);
              });
          } else {
            stopSpinner();
            showErrorMessage(
              'Error editing project: ' + old_options.name,
              'Internal error editing the project.'
            );
            console.log(res);
          }
          return res;
        })
        .catch((msg: any) => {
          stopSpinner();
          showErrorMessage(
            'Error editing project' + old_options.name,
            'Request to edit the project failed.'
          );
          console.log(msg);
        });
    }

    let dialogResult: {
      changesSaved: boolean;
      newOptions?: ISWANOptions;
    } | null = null;
    dialogResult = await showDialog(options, theme, stacks);
    if (dialogResult?.changesSaved && dialogResult?.newOptions) {
      options = dialogResult.newOptions;
    }
    if (dialogResult.changesSaved) {
      startSpinner();
      if (isNewProject) {
        await createProjectRequest(options)
          .then((res: ISWANReqResponse) => {
            if (res.status) {
              commands.execute('filebrowser:go-to-path', {
                path: res.project_dir,
                showBrowser: false,
              });
            } else {
              stopSpinner();
              showErrorMessage(
                'Error creating project: ' + options.name,
                'Internal error creating the project.'
              );
              console.log(res);
            }
            return res;
          })
          .catch((msg: any): void => {
            stopSpinner();
            showErrorMessage(
              'Error creating project',
              'Request to create the project failed.'
            );
            console.log(msg);
          });
      } else {
        if (old_options.name != options.name) {
          await commands
            .execute('filebrowser:go-to-path', {
              path: '/SWAN_projects',
              showBrowser: false,
            })
            .then(async () => {
              await editProject(old_options, options);
            })
            .catch((msg: any) => {
              stopSpinner();
              showErrorMessage(
                'Error moving to /SWAN_projects to edit the project: ' +
                  old_options.name,
                msg
              );
              console.log(msg);
            });
        } else {
          await editProject(old_options, options);
        }
      }
      stopSpinner();
    }
  }
}
