// Copyright (c) SWAN Development Team.
// Author: Omar.Zapata@cern.ch 2021

import React from 'react';
import { ReactWidget } from '@jupyterlab/apputils';
import { Widget } from '@lumino/widgets';

import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';

import { ThemeProvider } from './theme-provider';
import { ProjectWidget } from './ProjectWidget';
import { ProjectDialog } from './ProjectDialog';

export async function showDialog(
  options: ProjectDialog.ISWANOptions & { theme: 'light' | 'dark' }
): Promise<{
  changesSaved: boolean;
  newOptions?: ProjectDialog.ISWANOptions;
}> {
  return new Promise(resolve => {
    const widget = ReactWidget.create(
      <ThemeProvider theme={options.theme || 'light'}>
        <Dialog open fullWidth maxWidth="sm">
          <DialogContent>
            <ProjectWidget
              options={options}
              onSubmit={newOptions => {
                Widget.detach(widget);
                resolve({
                  changesSaved: true,
                  newOptions
                });
              }}
              onCancel={() => {
                Widget.detach(widget);
                resolve({
                  changesSaved: false
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
