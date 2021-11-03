// Copyright (c) SWAN Team.
// Author: Omar Zapata CERN 2021

/**
 * ProjectDialog is a modal dialog that allows to create and edit projects,
 * the dialog allows to select the stack, release, platform and write in a textbox
 * a bash script to run inside the project.
 *
 * If the .swanproject file is corrupted for any reason, this dialog will appear
 * for the user in order to recover the project with the right information provide by he/she.
 */

import { showErrorMessage } from '@jupyterlab/apputils';
import { showDialog } from './dialog';
import {
  contentRequest,
  createProjectRequest,
  editProjectRequest,
} from './request';
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
       * Function to start the spiner in the SwanLauncer, embed in the html tag with id jp-main-dock-panel.
       */
      const node = document.getElementById('jp-main-dock-panel');
      node?.appendChild(_spinner.node);
      node?.focus();
      _spinner.activate();
      _spinner.show();
      _spinner.node.focus();
    }

    /**
     * hides the spiner from the component
     */
    function stopSpinner(): void {
      _spinner.hide();
    }

    /**
     * Check if the name of the project is valid,
     * to create a new one or when you want to edit the name.
     */
    async function isValidProjectName(project_name: string): Promise<boolean> {
      let valid = false;
      try {
        // FIXME: requires full path to the project when porject can be anywhere
        const content = await contentRequest('SWAN_projects/' + options.name);
        if (content === undefined) {
          valid = true;
        }
      } catch (error) {
        // No message here, it is not needed,
        //I am checking if the directory doesn't exist in order
        //to make valid the creation of the project folder.
      }
      if (!valid) {
        await showErrorMessage(
          'Invalid project name',
          'File or directory already exists with the same name.'
        );
      }
      return valid;
    }

    let valid = false;
    let dialogResult: {
      changesSaved: boolean;
      newOptions?: ISWANOptions;
    } | null = null;
    do {
      dialogResult = await showDialog(
        {
          ...options,
          theme,
        },
        { ...stacks }
      );
      if (dialogResult?.changesSaved && dialogResult?.newOptions) {
        options = dialogResult.newOptions;
        if (options.name?.trim() !== '') {
          //check if project already exists
          if (isNewProject) {
            valid = await isValidProjectName(options.name);
          } else {
            //this is a special case for editing because I need to check that the new name of the project doesn't exists.
            if (old_options.name !== options.name) {
              valid = await isValidProjectName(options.name);
              if (!valid) {
                continue;
              }
            }
            if (options.corrupted) {
              valid = true;
              break;
            }
            // verifying that options changed, otherwise I will not send the request
            if (JSON.stringify(old_options) !== JSON.stringify(options)) {
              valid = true;
            } else {
              valid = false;
            }
          }
        }
        if (options.name?.trim() === '') {
          await showErrorMessage(
            'Invalid project name',
            'Select a valid (non-empty) project name.'
          );
          valid = false;
        }
      } else {
        valid = true;
      }
    } while (!valid);
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
              showErrorMessage('Error creating project', res.msg);
            }
            return res;
          })
          .catch((msg: any): void => {
            stopSpinner();
            showErrorMessage('Error creating project', msg);
          });
      } else {
        await commands
          .execute('filebrowser:go-to-path', {
            path: '/SWAN_projects',
            showBrowser: false,
          })
          .then(async () => {
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
                      console.log(
                        'Error moving from edited project  ' + old_options.name
                      );
                      console.log(msg);
                    });
                } else {
                  stopSpinner();
                  showErrorMessage('Error editing project', res.msg);
                }
                return res;
              })
              .catch((msg: any) => {
                stopSpinner();
                console.log('Error editing project: ' + old_options.name);
                console.log(msg);
              });
          })
          .catch((msg: any) => {
            stopSpinner();
            console.log(
              'Error moving to /SWAN_projects to edit the project: ' +
                old_options.name
            );
            console.log(msg);
          });
      }
      stopSpinner();
    }
  }
}
