// Copyright (c) SWAN Development Team.
// Author: Omar.Zapata@cern.ch 2021

/**
 * File with utility function "showDialog" to display the react widget with mutliple components of the dialog,
 * see showDialog documentation for more details.
 */

import React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';

import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';

import { ThemeProvider } from './theme-provider';
import { ProjectWidget } from './ProjectWidget';
import { ProjectDialog } from './ProjectDialog';

/**
 * Utility function to display the ProjectWidget.
 * This function allows to create a ReactWidget to embed all the components
 * and attach it to the document body.
 *
 * @param options - The dialog setup options.
 * @param stacks - Available stack options.
 * @param theme - colors in the interface 'light' | 'dark'.
 * @returns A promise that resolves with whether the dialog was accepted
 */

export async function showDialog(
  options: ProjectDialog.ISWANOptions,
  theme: 'light' | 'dark',
  stacks: ProjectDialog.ISWANStackOptions
): Promise<{
  changesSaved: boolean;
  newOptions?: ProjectDialog.ISWANOptions;
}> {
  return new Promise((resolve) => {
    const widget = ReactWidget.create(
      <ThemeProvider theme={theme || 'light'}>
        <Dialog open fullWidth maxWidth="sm">
          <DialogContent>
            <ProjectWidget
              options={options}
              stacks={stacks}
              onSubmit={(newOptions) => {
                Widget.detach(widget);
                resolve({
                  changesSaved: true,
                  newOptions,
                });
              }}
              onCancel={() => {
                Widget.detach(widget);
                resolve({
                  changesSaved: false,
                });
              }}
            />
          </DialogContent>
        </Dialog>
      </ThemeProvider>
    );
    Widget.attach(widget, document.body);
  });
}
