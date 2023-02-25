import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';

/**
 * Calls /api/contents/fetch/ with the url to download,
 * which downloads the notebook/project URL to the home directory of the user 
 * This is used by the 'Examples Gallery' listener to download example notebooks.
 * @returns The Jupyter server contents API response of the downloaded file
 */

export async function downloadUrlFromServer(
    urlToDownload: string,
): Promise<any> {
    const settings = ServerConnection.makeSettings();

    let requestUrl = URLExt.join(
        settings.baseUrl,
        'api',
        'contents',
        'fetch'
    );

    requestUrl = requestUrl + '?url=' + urlToDownload; //Add project url parameter

    let response: Response;
    try {
        response = await ServerConnection.makeRequest(requestUrl, {}, settings);
    } catch (error) {
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
