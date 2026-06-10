import { LabIcon } from '@jupyterlab/ui-components';
import { swanProjectIcon, swanConfigIcon, swanReadmeIcon } from './icons';
import { JSONObject } from '@lumino/coreutils';

import * as React from 'react';

import ReactMarkdown from 'react-markdown';
import { CommandRegistry } from '@lumino/commands';
import { SWANLauncher } from './launcher';

export type SWANProjectIOptions = {
  is_project: boolean;
  name?: string;
  stack?: string;
  release?: string | '';
  platform?: string | '';
  user_script?: string | '';
  readme?: string | null;
  commands?: CommandRegistry;
  launcher?: SWANLauncher;
};

export function ProjectHeader(props: SWANProjectIOptions): JSX.Element {
  async function changeStack() {
    await props.launcher?.projectInfoRequest(props.launcher?.cwd as string).then(async (project_info:any) => {
      if (project_info.hasOwnProperty('project_data')) {
        const project_data = project_info['project_data'] as JSONObject;
        await props.commands
        ?.execute('swan:edit-project-dialog', {
          name: project_data['name'] as string,
          stack: project_data['stack'] as string,
          release: project_data['release'] as string,
          platform: project_data['platform'] as string,
          user_script: project_data['user_script'] as string
        })
      .catch(message => {
        console.log(message);
      });
        }
    })
  }
  return (
    <table
      style={{
        width: '100%',
        height: '64px',
        display: props.is_project ? '' : 'none'
      }}
    >
      <tbody>
        <tr>
          <td style={{ width: '48px' }}>
            <LabIcon.resolveReact
              icon={swanProjectIcon}
              stylesheet="launcherSection"
            />
          </td>
          <td style={{ textAlign: 'left' }}>
            <h2 className="jp-Launcher-sectionTitle">{props.name}</h2>
          </td>
          <td style={{ textAlign: 'right', color: '#808080' }}>
            {props.release} ({props.platform})
          </td>
          <td
            style={{
              textAlign: 'right',
              width: '24px',
              height: '24px',
              color: '#808080'
            }}
          >
            <div
              className=""
              id="swan_config_button"
              style={{ width: '26px', height: '26px', borderRadius: '85x' }}
              onClick={changeStack}
            >
              <div
                className="jp-LauncherCard-icon"
                style={{ width: '26px', height: '26px' }}
              >
                {
                  <LabIcon.resolveReact
                    icon={swanConfigIcon}
                    width="20px"
                    height="20px"
                    display="block"
                    margin-left="auto"
                    margin-right="auto"
                  />
                }
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function ProjectReadme(props: SWANProjectIOptions): JSX.Element {
  if (props.is_project && props.readme !== null) {
    return (
      <div
        className="jp-Launcher-section"
        key="Readme"
        style={{ display: props.is_project ? '' : 'none' }}
      >
        <div className="jp-Launcher-sectionHeader">
          <LabIcon.resolveReact
            icon={swanReadmeIcon}
            stylesheet="launcherSection"
          />
          <h2 className="jp-Launcher-sectionTitle">Readme</h2>
        </div>
        <div className="jp-Launcher-cardContainer"></div>
        <ReactMarkdown>{props.readme as string}</ReactMarkdown>
      </div>
    );
  } else {
    return <div />;
  }
}
