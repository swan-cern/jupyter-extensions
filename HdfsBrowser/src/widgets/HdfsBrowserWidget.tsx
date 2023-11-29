import { IFrame } from '@jupyterlab/ui-components';
import { ServerConnection } from '@jupyterlab/services';

/**
 * A class that exposes the git plugin Widget.
 */
export class HdfsBrowserWidget extends IFrame {

    /**
     * Construct a console panel.
     */
    constructor() {
        super();

        this.sandbox = [
            'allow-same-origin',
            'allow-scripts'
        ];
        
        this.url = ServerConnection.makeSettings().baseUrl + "hdfsbrowser/explorer.html";
    }
}