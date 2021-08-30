// Copyright (c) SWAN Development Team.
// Author: Omar.Zapata@cern.ch 2021

import { LabIcon } from '@jupyterlab/ui-components';

import swanProjectIconStr from '../style/project.svg';
import swanReadmeIconStr from '../style/list-alt.svg';
import cmsIconStr from '../style/cms.svg';
import sftIconStr from '../style/sft.svg';

export const swanProjectIcon = new LabIcon({
  name: 'jupyterlab_swan:project',
  svgstr: swanProjectIconStr
});

export const swanReadmeIcon = new LabIcon({
  name: 'jupyterlab_swan:reame',
  svgstr: swanReadmeIconStr
});

export const cmsIcon = new LabIcon({
  name: 'jupyterlab_swan:cms',
  svgstr: cmsIconStr
});

export const sftIcon = new LabIcon({
  name: 'jupyterlab_swan:sft',
  svgstr: sftIconStr
});
