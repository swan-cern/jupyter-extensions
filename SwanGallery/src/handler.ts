import { URLExt } from '@jupyterlab/coreutils';

import { ServerConnection } from '@jupyterlab/services';

/**
 * Call the API extension
 *
 * @param endPoint API REST end point for the extension
 * @param init Initial values for the request
 * @returns The response body interpreted as JSON
 */

export async function requestAPI<T>(
  projUrl: string,
  endPoint = '',
  init: RequestInit = {}
): Promise<T> {
  
  let settings = ServerConnection.makeSettings();
  
  let requestUrl = URLExt.join(
    settings.baseUrl,
    'SwanGallery', // API Namespace
    endPoint
  );

  requestUrl = requestUrl+"?url="+projUrl; //Add project url parameter 

  let response: Response;
  try {
    response = await ServerConnection.makeRequest(requestUrl, init, settings);
    }   
    catch (error) {
    throw new ServerConnection.NetworkError(<TypeError>error);
  }

  let data: any;

  try {
    data = await response.json();
  } catch (error) {
    console.log('Not a JSON response body.', error);
  }
  

  if (!response.ok) {
    throw new ServerConnection.ResponseError(response, data.message || data);
  }

  return data;
}