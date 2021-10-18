// Copyright (c) SWAN Development Team.
// Author: Omar.Zapata@cern.ch 2021

import { URLExt } from '@jupyterlab/coreutils';

import { ServerConnection } from '@jupyterlab/services';
import { ProjectDialog } from './ProjectDialog';

/**
 * Call the API extension, base function to implement the other requests
 *
 * @param endPoint API REST end point for the extension
 * @param init Initial values for the request
 * @returns The response body interpreted as JSON
 */
export async function request<T>(
  endPoint = '',
  init: RequestInit = {}
): Promise<T> {
  // Make request to Jupyter API
  const settings = ServerConnection.makeSettings();
  const requestUrl = URLExt.join(settings.baseUrl, '', endPoint);

  let response: Response;
  try {
    response = await ServerConnection.makeRequest(requestUrl, init, settings);
  } catch (error) {
    throw new ServerConnection.NetworkError(error);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ServerConnection.ResponseError(response, data.message);
  }

  return data;
}

/**
 * Request to get contents from a path
 *
 * @param cwd path get information from jupyter api
 * @returns json object with the information of the path or json object with the information of the error.
 */
export function contentRequest(cwd: string): any {
  try {
    return request<any>('api/contents/' + cwd, {
      method: 'GET'
    });
  } catch (reason) {
    const msg = `Error on GET 'api/contents'+ ${cwd}.\n${reason}`;
    return { status: 'error', reason: reason, param: cwd, msg: msg };
  }
}

/**
 * Request to create a project
 *
 * @param options parameters to send to the backend, such as name, stack, release etc..
 * @returns  json object with the keys 'project_dir' and 'msg' or json object with the information of the error.
 */
export function createProjectRequest(options: ProjectDialog.ISWANOptions): any {
  const dataToSend = {
    name: options.name,
    stack: options.stack,
    release: options.release,
    platform: options.platform,
    user_script: options.user_script
  };
  try {
    return request<any>('swan/project/create', {
      body: JSON.stringify(dataToSend),
      method: 'POST'
    });
  } catch (reason) {
    const msg = `Error on POST /swan/project/create ${options}.\n${reason}`;
    return { status: 'error', reason: reason, param: options, msg: msg };
  }
}

/**
 * Request to edit project
 *
 * @param old_name previous name of the project
 * @param options new project parameters to send to the backend, such as name, stack, release etc..
 * @returns json object with the keys 'project_dir' and 'msg' or json object with the information of the error.
 */
export function editProjectRequest(
  old_options: ProjectDialog.ISWANOptions,
  options: ProjectDialog.ISWANOptions
): any {
  const dataToSend = {
    old_name: old_options.name,
    old_stack: old_options.stack,
    old_release: old_options.release,
    old_platform: old_options.platform,
    old_userscript: old_options.user_script,
    name: options.name,
    stack: options.stack,
    release: options.release,
    platform: options.platform,
    user_script: options.user_script,
    corrupted: options.corrupted
  };
  try {
    return request<any>('swan/project/edit', {
      body: JSON.stringify(dataToSend),
      method: 'PUT'
    });
  } catch (reason) {
    const msg = `Error on PUT swan/project/edit ${options}.\n${reason}`;
    return { status: 'error', reason: reason, param: options, msg: msg };
  }
}

/**
 * Request to get the information for the software stacks
 *
 * @returns json with the software stack names, releases, platform, etc..
 */
export function kernelsInfoRequest(): any {
  try {
    return request<any>('swan/stacks/info', {
      method: 'GET'
    });
  } catch (reason) {
    console.error(`Error on GET 'swan/stacks/info'.\n${reason}`);
  }
}
