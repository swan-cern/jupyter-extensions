import { LabIcon } from '@jupyterlab/ui-components';

import swanProjectIconStr from '../style/project.svg';
import swanProjectImportIconStr from '../style/cloud-download-alt.svg';
import swanReadmeIconStr from '../style/list-alt.svg';
import swanConfigIconStr from '../style/cog.svg';

import swanProjectsIconStr from '../style/projects.svg';

import cernboxIconStr from '../style/cernbox.svg';

export const swanProjectIcon = new LabIcon({
  name: 'jupyterlab_swan:project',
  svgstr: swanProjectIconStr
});

export const swanProjectImportIcon = new LabIcon({
  name: 'jupyterlab_swan:project_import',
  svgstr: swanProjectImportIconStr
});

export const swanReadmeIcon = new LabIcon({
  name: 'jupyterlab_swan:reame',
  svgstr: swanReadmeIconStr
});

export const swanConfigIcon = new LabIcon({
  name: 'jupyterlab_swan:config',
  svgstr: swanConfigIconStr
});

export const swanProjectsIcon = new LabIcon({
  name: 'jupyterlab_swan:projects',
  svgstr: swanProjectsIconStr
});

export const cernboxIcon = new LabIcon({
  name: 'jupyterlab_swan:cernbox',
  svgstr: cernboxIconStr
});
