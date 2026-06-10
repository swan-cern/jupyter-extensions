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
import { swanProjectIcon } from './icons';
import { LabIcon } from '@jupyterlab/ui-components';

import { ProjectDialog } from './ProjectDialog';

import { contentRequest } from './request';

/**
 * Functio to create the widget required for the modal dialog, it is basically a form,
 * also it has the callbacks to handle the events.
 *
 * @param options - The dialog setup options.
 * @param stacks - Available stack options.
 * @param onSubmit - callback to execute on submit action
 * @param onCancel - callback to execute on cancel action.
 * @returns the DOM element with the form.
 */
export const ProjectWidget: React.FunctionComponent<{
  options: ProjectDialog.ISWANOptions;
  stacks: ProjectDialog.ISWANStackOptions;
  onSubmit: (selectedOptions: ProjectDialog.ISWANOptions) => void;
  onCancel: () => void;
}> = (props) => {
  const options = props.options;
  const stacks = props.stacks;
  const [projectName, setProjectName] = React.useState(options.name || '');
  const [helperText, setHelperText] = React.useState({
    helperText: '',
    error: false,
  });

  const availableStacks = Object.keys(stacks.stacks_options).filter((e) => {
    return e !== "path";
  });
  const defaultStack = availableStacks.includes(options.stack)
    ? options.stack
    : availableStacks[0];
  const [stack, setStack] = React.useState(defaultStack);

  const availableReleases = Object.keys(
    stacks.stacks_options[stack]['releases']
  );
  const defaultRelease = availableReleases.includes(options.release)
    ? options.release
    : availableReleases[0];
  const [release, setRelease] = React.useState(defaultRelease);

  const availablePlatforms = stacks.stacks_options[stack]['releases'][release];
  const defaultPlatform = availablePlatforms.includes(options.platform)
    ? options.platform
    : availablePlatforms[0];
  const [platform, setPlatform] = React.useState(defaultPlatform);

  const [userScript, setUserScript] = React.useState(options.user_script || '');
  const stack_icons: { [item: string]: LabIcon } = {};

  const randomId = () => {
    return Math.random().toString(36).substring(2, 15);
  };

  availableStacks.map((item) => {
    stack_icons[item] = new LabIcon({
      name: 'jupyterlab_swan_stack:' + randomId(),
      svgstr: stacks.stacks_options[item]['logo'],
    });
  });

  async function checkProjectName(project_name: string): Promise<boolean> {
    let content = undefined;
    try {
      // FIXME: requires full path to the project when porject can be anywhere
      content = await contentRequest('SWAN_projects/' + project_name);
    } catch (error) {
      // No message here, it is not needed,
      //I am checking if the directory doesn't exist in order
      //to make valid the creation of the project folder.
    }
    if (content === undefined) {
      return true;
    }
    return false;
  }

  const onClickSubmit = () => {
    const selectedOptions: ProjectDialog.ISWANOptions = {
      name: projectName.trim(),
      stack,
      release,
      platform,
      user_script: userScript,
      corrupted: options.corrupted,
    };
    // validating is not an empty name
    if (projectName.trim() === '') {
      setHelperText({
        helperText: 'Select a valid (non-empty) project name.',
        error: true,
      });
      return;
    }
    // validating changes were made in any field, to avoid send the request
    if (
      JSON.stringify(selectedOptions) === JSON.stringify(options) &&
      !options.corrupted
    ) {
      return;
    }

    // if the name was changed, then I need to check it with the contents manager
    if (projectName != options.name) {
      checkProjectName(projectName).then((valid: boolean) => {
        if (valid) {
          props.onSubmit(selectedOptions);
        } else {
          setHelperText({
            helperText: 'File or directory already exists with the same name.',
            error: true,
          });
          return;
        }
      });
    } else {
      props.onSubmit({
        name: projectName,
        stack,
        release,
        platform,
        user_script: userScript,
        corrupted: options.corrupted,
      });
    }
  };

  const onClickCancel = () => {
    props.onCancel();
  };

  const onChangeProjectName = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProjectName(event.target.value);
  };

  const onChangeStack = (newStack: string) => {
    setStack(newStack);
    const newRelease = Object.keys(
      stacks.stacks_options[newStack]['releases']
    )[0];
    setRelease(newRelease);
    const newPlatform =
      stacks.stacks_options[newStack]['releases'][newRelease][0];
    setPlatform(newPlatform);
  };

  const onChangeRelease = (event: React.ChangeEvent<{ value: unknown }>) => {
    const newRelease = event.target.value as string;
    setRelease(newRelease);
    const newPlatform = stacks.stacks_options[stack]['releases'][newRelease][0];
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
          {...helperText}
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
        {availableStacks.map((item) => (
          <Card
            key={item}
            label={item}
            icon={stack_icons[item]}
            updateCallback={() => onChangeStack(item)}
            isSelected={stack === item}
          />
        ))}
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
