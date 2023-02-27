import { Dialog, showDialog } from '@jupyterlab/apputils';
import { LabIcon } from '@jupyterlab/ui-components'
import * as React from 'react';
import swanSvgstr from '../style/icons/logo-swan.svg';

const swanIcon = new LabIcon({ name: 'ui-components:swan', svgstr: swanSvgstr });

export function showAboutDialog() {
  // Create the header of the about dialog
  let title = (
    <span className="jp-About-header">
      <swanIcon.react margin="7px 9.5px" height="auto" width="100px" />
      <span className="jp-AboutSWAN-name">
        <h1>SWAN</h1>
        <span className="jp-About-copyright">
          © CERN 2016-{(new Date().getFullYear())}.<br />All rights reserved.
        </span>
      </span>
    </span>
  );

  let body = (
    <div className="jp-AboutSWAN-body">
      <span className="jp-About-externalLinks">
        <a
          href="https://cern.ch/swan/"
          target="_blank"
          rel="noopener"
          className="jp-Button-flat"
        >Home Page</a>
        <a
          href="https://github.com/swan-cern"
          target="_blank"
          rel="noopener"
          className="jp-Button-flat"
        >Github</a>
      </span>
    </div>
  );

  return showDialog({
    title,
    body,
    buttons: [
      Dialog.createButton({
        label: 'Dismiss',
        className: 'jp-About-button jp-mod-reject jp-mod-styled'
      })
    ]
  });
}


export function showLoadingSpinnerDialog() {
  // Create the header of the about dialog
  const title = (
    <div>Downloading Example</div>
  );
  const body = <div className="sw-loading-spinner"></div>

  const dialogOptions = {
    title,
    body,
    buttons: [] as any,
    hasClose: false
  };

  const dialog = new Dialog(dialogOptions);
  dialog.launch();
  return dialog;
}