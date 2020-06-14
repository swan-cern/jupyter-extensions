import { IFrame } from '@jupyterlab/apputils';

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
        this.url = "/hdfsbrowser/explorer.html";
    }
}