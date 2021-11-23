// Copyright (c) SWAN Development Team.
// Author: Omar.Zapata@cern.ch 2021

/**
 * This file containts the implementation for SwanFileBrowser and SwanFileBrowserModel classes.
 *
 * Those classes are the replacement for the default FileBrowser and allows to
 * manipulated the paths to check is the folder is a project or not and to set the proper kernel path.
 */

import { FilterFileBrowserModel, FileBrowser } from '@jupyterlab/filebrowser';
import { request } from './request';
import { validateSpecModels } from './kernelspec/validate';
import { SwanDirListing } from './listing';
import { JSONObject } from '@lumino/coreutils';
import { showErrorMessage, Dialog } from '@jupyterlab/apputils';
import { CommandRegistry } from '@lumino/commands';
/**
 * SWAN Project options from .swanproject
 * this is required to validate that the project file is not corrupted
 */
export interface ISwanProjectOptions {
  name?: string;
  stack?: string;
  release?: string;
  platform?: string;
  user_script?: string;
  python2?: any;
  python3?: any;
  kernel_dirs?: string[];
}

/**
 * Customized SwanFileBrowserModel that inherits from FilterFileBrowserModel.
 *
 * This class has overloaded the method 'async cd(newValue: string): Promise<void>'
 * that a allows to take actions before go to the directory, actions like:
 * 1) Get the contents of the folder (to check if the folder is a project)
 * 2) If the  folder is a project we can ge the information of the project stored in the .swanproject
 * 3) if the information for the project is right then we can set the kernel spec manager
 * 4) If the project is corrupted, the a Dialog is showed up telling the user the project requires
 *    to be configured again and the ProjectDialog is called.
 */
export class SwanFileBrowserModel extends FilterFileBrowserModel {
  constructor(
    options: FilterFileBrowserModel.IOptions,
    commads: CommandRegistry
  ) {
    super(options);
    this._commands = commads;
    this.kernelSpecSetPathRequest(this.path);
  }

  /**
   * Request to set the kernelspec manager path in the backend.
   * Local service manager.services.kernelspecs is updated as well.
   *
   * @param path path get information from jupyter api
   * @returns json object with the information of the path or json object with the information of the error.
   */
  protected kernelSpecSetPathRequest(path: string): any {
    const dataToSend = { path: path, caller: 'swanfilebrowser' };
    try {
      return request<any>('/swan/kernelspec/set', {
        body: JSON.stringify(dataToSend),
        method: 'POST'
      }).then(async (rvalue: { is_project: boolean; path: string }) => {
        return request<any>('/api/kernelspecs', {
          method: 'GET'
        })
          .then(specs => {
            if (rvalue.is_project) {
              const validate_specs = validateSpecModels(specs);
              return Object.defineProperty(
                this.manager.services.kernelspecs,
                'specs',
                {
                  value: validate_specs,
                  configurable: true
                }
              );
            } else {
              return Object.defineProperty(
                this.manager.services.kernelspecs,
                'specs',
                {
                  value: null,
                  configurable: true
                }
              );
            }
          })
          .catch((err: any) => {
            console.log(err);
          });
      });
    } catch (reason) {
      console.error(
        `Error on POST 'swan/kernelspec/set'+ ${dataToSend}.\n${reason}`
      );
    }
  }

  /**
   * Request to get the project information
   *
   * @param path path to the project
   * @returns json object with the project information information.
   */
  protected projectInfoRequest(path: string): any {
    const uri = 'swan/project/info?caller=swanfilebrowser&path=' + path;
    try {
      return request<any>(uri, {
        method: 'GET'
      });
    } catch (reason) {
      console.error(`Error on GET ${uri}.\n${reason}`);
    }
  }

  /**
   * Request to get contents from a path
   *
   * @param cwd path get information from jupyter api
   * @returns json object with the information of the path
   */
  protected contentRequest(cwd: string): any {
    try {
      return request<any>('api/contents/' + cwd, {
        method: 'GET'
      }).then(rvalue => {
        return rvalue;
      });
    } catch (reason) {
      console.error(`Error on GET 'api/contents'+ ${cwd}.\n${reason}`);
    }
  }

  /**
   * Method to check if the project information is valid or it is corrupted.
   *
   * @param project_data json with project data such as name, stack, release etc..
   * @returns true if the project is valid or false it the project is corrupted.
   */
  protected isValidProject(project_data: JSONObject): boolean {
    for (const tag in this.project_tags) {
      if (!(this.project_tags[tag] in project_data)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Overloaded method cd, to check folder information before go in.
   *
   * @param newValue new path
   * @returns void promise.
   */
  async cd(newValue: string): Promise<void> {
    if (newValue !== '.') {
      const content = await this.contentRequest(newValue);
      if (content.is_project === true) {
        const project_info = await this.projectInfoRequest(newValue);
        const project_data = project_info[
          'project_data'
        ] as ISwanProjectOptions;
        if (this.isValidProject(project_data as JSONObject)) {
          await this.kernelSpecSetPathRequest(newValue);
          return super.cd(newValue);
        } else {
          const okButton = Dialog.okButton({ accept: false });
          await showErrorMessage(
            'Project Error:',
            'Error reading the configuration of project ' +
              project_data?.name +
              ', please click OK to define a new one.',
            [okButton]
          );

          if (okButton.accept) {
            await this._commands
              .execute('swan:edit-project-dialog', {
                name: project_data?.name,
                stack: project_data?.stack,
                release: project_data?.release,
                platform: project_data?.platform,
                user_script: project_data?.user_script,
                corrupted: true
              })
              .catch(message => {
                console.log(message);
              });
          }
          await this.kernelSpecSetPathRequest(this.path);
          return super.cd('.'); // we stay in the current directory to fix the project at the moment
        }
      } else {
        return super.cd(newValue).then(async () => {
          await this.kernelSpecSetPathRequest(this.path);
        });
      }
    } else {
      return super.cd(newValue);
    }
  }
  private project_tags: string[] = [
    'name',
    'stack',
    'release',
    'platform',
    'python2',
    'python3',
    'kernel_dirs'
  ];
  private _commands: CommandRegistry;
}

/**
 * Customized SwanFileBrowser that inherits from FileBrowser.
 *
 * This class allows to set our classes SwanFileBrowserModel and SwanDirListing.
 *
 */
export class SwanFileBrowser extends FileBrowser {
  constructor(options: FileBrowser.IOptions) {
    super(options);
    super.id = options.id;
    const model = (this.model = <SwanFileBrowserModel>options.model);
    const renderer = options.renderer;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.layout.removeWidget(this._listing);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this._listing = this.createDirListing({
      model,
      renderer,
      translator: this.translator
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.layout.addWidget(this._listing);
  }

  /**
   * Create the underlying SwanDirListing instance.
   *
   * @param options - The SwanDirListing constructor options.
   *
   * @returns The created SwanDirListing instance.
   */
  protected createDirListing(options: SwanDirListing.IOptions): SwanDirListing {
    return new SwanDirListing(options);
  }

  public model: SwanFileBrowserModel;
}
