import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';

async function request(url: string, init: RequestInit = {}): Promise<any> {
  // Make request to Jupyter API
  const settings = ServerConnection.makeSettings();
  const requestUrl = URLExt.join(settings.baseUrl, '', url);

  let response: Response;
  try {
    response = await ServerConnection.makeRequest(requestUrl, init, settings);
  } catch (error: any) {
    throw new ServerConnection.NetworkError(error);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ServerConnection.ResponseError(response, data.message);
  }
  return data;
}

export async function getAvailableSoftwareStacksRequest(): Promise<any> {
  try {
    const content = await request('swan/stacks', {
      method: 'GET'
    });
    return content;
  } catch (error) {
    console.log('Failed to fetch software stacks', error);
  }
}

export async function getProjectRequest(path: string): Promise<any> {
  const uri = `swan/projects/${path}`;
  try {
    const response = await request(uri, {
      method: 'GET'
    });
    return {
      project: response['project_data'],
      isProjectAllowedInPath: response['allow_project_in_path']
    };
  } catch (error) {
    console.error(`Error on GET ${uri}.\n${error}`);
    throw error;
  }
}

export async function editProjectRequest(
  path: any,
  project: any
): Promise<any> {
  const dataToSend = {
    ...project
  };
  try {
    return await request(`swan/projects/${path}`, {
      body: JSON.stringify(dataToSend),
      method: 'PATCH'
    });
  } catch (reason) {
    const req = { status: false, errorMessage: 'Network error' };
    return req;
  }
}
