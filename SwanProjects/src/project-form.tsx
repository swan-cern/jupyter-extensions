import React from 'react';

import Button from '@material-ui/core/Button';
import TextField from '@material-ui/core/TextField';
import MenuItem from '@material-ui/core/MenuItem';

import { ProjectDialogCard } from './components/card';
import { HelpTooltip } from './components/help-tooltip';
import { LabIcon, folderIcon } from '@jupyterlab/ui-components';

import { ProjectData } from './types';
import { Alert } from '@material-ui/lab';
import { CircularProgress } from '@material-ui/core';

export const ProjectForm: React.FunctionComponent<{
  isLoading: boolean;
  project?: ProjectData;
  path: string;
  availableStacks: any;
  errorMessage?: string;
  onSubmit: (selectedOptions: any) => void;
  onCancel: () => void;
}> = props => {
  const project = props.project!;

  const availableStacks = Object.keys(props.availableStacks);
  const defaultStackType = ['default', ...availableStacks].includes(
    project?.stack?.type
  )
    ? project?.stack?.type
    : availableStacks[0];
  const [stackType, setStackType] = React.useState(defaultStackType);

  let defaultRelease: string = '';
  let defaultPlatform: string = '';
  let availableReleases: string[] = [];
  let availablePlatforms: string[] = [];

  if (stackType != 'default') {
    availableReleases = Object.keys(props.availableStacks[stackType].releases);
    if (
      project?.stack?.release &&
      availableReleases.includes(project?.stack?.release)
    ) {
      defaultRelease = project?.stack?.release || '';
    } else {
      defaultRelease = availableReleases[0];
    }
  }
  const [release, setRelease] = React.useState(defaultRelease);

  if (stackType != 'default') {
    availablePlatforms = props.availableStacks[stackType].releases[release];
    if (
      project?.stack?.platform &&
      availablePlatforms.includes(project?.stack?.platform)
    ) {
      defaultPlatform = project?.stack?.platform;
    } else {
      defaultPlatform = availablePlatforms[0];
    }
  }

  const [platform, setPlatform] = React.useState(defaultPlatform);

  const [userScript, setUserScript] = React.useState(
    props.project?.user_script || ''
  );
  const stack_icons: { [item: string]: LabIcon } = {};

  availableStacks.map((item, key) => {
    stack_icons[item] = new LabIcon({
      name: `jupyterlab_swan_stack:${key}`,
      svgstr: props.availableStacks[item].logo
    });
  });

  const onClickSubmit = () => {
    if (stackType == 'default') {
      props.onSubmit({
        stack: {
          type: stackType
        }
      });
    } else {
      props.onSubmit({
        stack: {
          type: stackType,
          release,
          platform
        },
        user_script: userScript
      });
    }
  };

  const onClickCancel = () => {
    props.onCancel();
  };

  const onChangeStack = (newStack: string) => {
    setStackType(newStack);
    if (newStack != 'default') {
      const newRelease = Object.keys(
        props.availableStacks[newStack]['releases']
      )[0];
      setRelease(newRelease);
      const newPlatform =
        props.availableStacks[newStack]['releases'][newRelease][0];
      setPlatform(newPlatform);
    }
  };

  const onChangeRelease = (event: React.ChangeEvent<{ value: unknown }>) => {
    const newRelease = event.target.value as string;
    setRelease(newRelease);
    const newPlatform =
      props.availableStacks.stacks_options[stackType]['releases'][
        newRelease
      ][0];
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

  const stackOptionsControls = (
    <>
      <Alert severity="info">
        Notebooks in this folder will always use the fixed software stack
        version selected below.
      </Alert>
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
            SelectProps={{
              MenuProps: {
                anchorOrigin: {
                  vertical: 'bottom',
                  horizontal: 'left'
                },
                getContentAnchorEl: null
              }
            }}
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
            SelectProps={{
              MenuProps: {
                anchorOrigin: {
                  vertical: 'bottom',
                  horizontal: 'left'
                },
                getContentAnchorEl: null
              }
            }}
            variant="outlined"
            value={platform}
            onChange={onChangePlatform}
            size="small"
            fullWidth
          >
            {availablePlatforms.map((platform: any, index: any) => {
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
    </>
  );

  const form = (
    <>
      <div>
        <div className="sw-Dialog-stack-option-label">
          <span> Software Stack </span>
          <span className="sw-Dialog-release-tooltip">
            <HelpTooltip
              id="release"
              message="Please select the software stack for notebooks in the project"
            />
          </span>
        </div>
        <div className="sw-Dialog-select-stack">
          <ProjectDialogCard
            key={'default'}
            label={'Global'}
            icon={stack_icons['LCG']}
            updateCallback={() => onChangeStack('default')}
            isSelected={stackType === 'default'}
          />
          <div className="sw-vertical-line"></div>
          {availableStacks.map(item => (
            <ProjectDialogCard
              key={item}
              label={item}
              icon={stack_icons[item]}
              updateCallback={() => onChangeStack(item)}
              isSelected={stackType === item}
            />
          ))}
        </div>
      </div>
      {stackType != 'default' ? (
        stackOptionsControls
      ) : (
        <Alert severity="info">
          This folder will use the software stack selected when starting the
          SWAN session.
        </Alert>
      )}
    </>
  );

  return (
    <div className="sw-Dialog-content">
      {props.errorMessage && (
        <Alert severity="error">{props.errorMessage}</Alert>
      )}
      <div className="sw-Dialog-project-name">
        <folderIcon.react className="sw-Dialog-project-icon" tag="span" />
        <span>{project?.full_path || props.path}</span>
      </div>
      {props.isLoading ? (
        <div className='sw-Dialog-project-loading'>
          <CircularProgress />
        </div>
      ) : (
        form
      )}
      <div className="sw-Dialog-button-area">
        <Button
          onClick={onClickCancel}
          variant="contained"
          disabled={props.isLoading}
        >
          Cancel
        </Button>
        <Button
          onClick={onClickSubmit}
          color="primary"
          variant="contained"
          disabled={props.isLoading}
        >
          Save
        </Button>
      </div>
    </div>
  );
};
