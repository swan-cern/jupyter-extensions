import React from 'react';
import { LabIcon, folderIcon } from '@jupyterlab/ui-components';
import Button from '@material-ui/core/Button';
import { ProjectData } from '../types';
import { ThemeProvider } from './theme-provider';

export function ProjectHeader(props: {
  project?: ProjectData | null;
  isProjectAllowedInPath: boolean;
  cwd: string;
  onClickChangeStack: () => void;
}): JSX.Element {
  const softwareStackMessage =
    props.project?.stack?.type && props.project?.stack?.type != 'default'
      ? `${props.project?.stack?.release} (${props.project?.stack?.release})`
      : 'Default LCG release selected for this SWAN session.';

  return (
    <ThemeProvider theme={'light'}>
      <div className="sw-launcher-project-header">
        <div className="sw-launcher-project-header-bar">
          <LabIcon.resolveReact
            icon={folderIcon}
            stylesheet="launcherSection"
          />
          <h2 className="jp-Launcher-sectionTitle sw-laucher-project-header-title">
            {props.cwd || 'Home'}
          </h2>
          <div className="sw-launcher-project-header-right">
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={() => {
                props.onClickChangeStack();
              }}
              disabled={!props.isProjectAllowedInPath}
            >
              {props.project ? 'Edit Environment' : 'Create Enviornment'}
            </Button>
          </div>
        </div>
        {props.project && (
          <div className="sw-launcher-project-header-root-path">
            Notebooks in this folder run using the environment defined in {props.project?.full_path}
          </div>
        )}
        <div className="sw-launcher-project-environment">
          <div>
            <b>Software Environment</b>
          </div>
          {softwareStackMessage}
        </div>
      </div>
    </ThemeProvider>
  );
}
