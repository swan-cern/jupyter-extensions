// Copyright (c) SWAN Development Team.
// Author: Omar.Zapata@cern.ch 2021

/**
 * This is the file with the React widget that has the components and callbacks
 * to capture the information for the project, such as name, stack, release, platform and bash user script. 
 */

import React from 'react';

import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import MenuItem from '@material-ui/core/MenuItem';

import { Card, HelpTooltip } from './Components';
export interface IStackOptions {
  visible: boolean;
}
import { swanProjectIcon, sftIcon, cmsIcon } from './icons';

import { ProjectDialog } from './ProjectDialog';


/**
 * Functio to create the widget required for the modal dialog, it is basically a form,
 * also it has the callbacks to handle the events.
 *
 * @param options - The dialog setup options.
 * @param onSubmit - callback to execute on submit action
 * @param onCancel - callback to execute on cancel action.
 * @returns the DOM element with the form.
 */
export const ProjectWidget: React.FunctionComponent<{
  options: ProjectDialog.ISWANOptions;
  onSubmit: (selectedOptions: ProjectDialog.ISWANOptions) => void;
  onCancel: () => void;
}> = props => {
  const options = props.options;
  const [projectName, setProjectName] = React.useState(options.name || '');

  const availableStacks = Object.keys(options.stacks_options);
  const defaultStack = availableStacks.includes(options.stack)
    ? options.stack
    : availableStacks[0];
  const [stack, setStack] = React.useState(defaultStack);

  const availableReleases = Object.keys(options.stacks_options[stack]);
  const defaultRelease = availableReleases.includes(options.release)
    ? options.release
    : availableReleases[0];
  const [release, setRelease] = React.useState(defaultRelease);

  const availablePlatforms = options.stacks_options[stack][release];
  const defaultPlatform = availablePlatforms.includes(options.platform)
    ? options.platform
    : availablePlatforms[0];
  const [platform, setPlatform] = React.useState(defaultPlatform);

  const [userScript, setUserScript] = React.useState(options.user_script || '');

  const onClickSubmit = () => {
    props.onSubmit({
      name: projectName,
      stack,
      release,
      platform,
      user_script: userScript,
      stacks_options: options.stacks_options // TODO remove this
    });
  };

  const onClickCancel = () => {
    props.onCancel();
  };

  const onChangeProjectName = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProjectName(event.target.value);
  };

  const onChangeStack = (newStack: string) => {
    setStack(newStack);
    const newRelease = Object.keys(options.stacks_options[newStack])[0];
    setRelease(newRelease);
    const newPlatform = options.stacks_options[newStack][newRelease][0];
    setPlatform(newPlatform);
  };

  const onChangeRelease = (event: React.ChangeEvent<{ value: unknown }>) => {
    const newRelease = event.target.value as string;
    setRelease(newRelease);
    const newPlatform = options.stacks_options[stack][newRelease][0];
    setPlatform(newPlatform);
  };

  const onChangePlatform = (event: React.ChangeEvent<{ value: unknown }>) => {
    setPlatform(event.target.value as string);
  };

  const onChangeUserScript = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setUserScript(event.target.value as string);
  };

  return (
    <div className="sw-Dialog-content">
      <div className="sw-Dialog-project-name">
        <swanProjectIcon.react className="sw-Dialog-project-icon" tag="span" />
        <TextField
          label="Project Name"
          variant="outlined"
          onChange={onChangeProjectName}
          className="sw-Dialog-project-name-input"
          size="small"
          required
          value={projectName}
        />
      </div>
      <div className="sw-Dialog-select-stack">
        <Card
          label="LCG"
          icon={sftIcon}
          updateCallback={() => onChangeStack('LCG')}
          isSelected={stack === 'LCG'}
        />
        <Card
          label="CMSSW"
          icon={cmsIcon}
          updateCallback={() => onChangeStack('CMSSW')}
          isSelected={stack === 'CMSSW'}
        />
      </div>
      <div className="sw-Dialog-stack-options">
        <div>
          <div className="sw-Dialog-stack-option-label">
            <span> Release </span>
            <span className="sw-Dialog-release-tooltip">
              <HelpTooltip
                id="release"
                message="Software stack to use in this project."
              />
            </span>
          </div>
          <TextField
            select
            variant="outlined"
            value={release}
            onChange={onChangeRelease}
            size="small"
            fullWidth
          >
            {availableReleases.map((release, index) => {
              return (
                <MenuItem value={release} key={index}>
                  {release}
                </MenuItem>
              );
            })}
          </TextField>
        </div>
        <div>
          <div className="sw-Dialog-stack-option-label">
            <span> Platform </span>
            <span className="sw-Dialog-release-tooltip">
              <HelpTooltip
                id="release"
                message="OS, architecture and compiler version."
              />
            </span>
          </div>
          <TextField
            select
            variant="outlined"
            value={platform}
            onChange={onChangePlatform}
            size="small"
            fullWidth
          >
            {availablePlatforms.map((platform, index) => {
              return (
                <MenuItem value={platform} key={index}>
                  {platform}
                </MenuItem>
              );
            })}
          </TextField>
        </div>
      </div>
      <div className="sw-Dialog-userscript">
        <div className="sw-Dialog-userscript-title">
          <div> User environment </div>
          <div className="sw-Dialog-userscript-tooltip">
            <HelpTooltip id="bash_script" message="User environment script" />
          </div>
        </div>
        <TextField
          multiline
          minRows={10}
          maxRows={10}
          variant="outlined"
          value={userScript}
          onChange={onChangeUserScript}
          placeholder="#!/bin/bash &#10;Bash user script code here"
        />
      </div>
      <div className="sw-Dialog-button-area">
        <Button onClick={onClickCancel} variant="contained">
          Cancel
        </Button>
        <Button onClick={onClickSubmit} color="primary" variant="contained">
          Add
        </Button>
      </div>
    </div>
  );
};
