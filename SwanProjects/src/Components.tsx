// Copyright (c) SWAN Development Team.
// Author: Omar.Zapata@cern.ch 2021
import { classes, LabIcon } from '@jupyterlab/ui-components';
import * as React from 'react';
import ReactTooltip from 'react-tooltip';

/**
 * @param id Id for the html element
 * @param message Message to display in the tooltip
 * @returns React Element
 */
export function HelpTooltip(props: {
  id: string;
  message: string;
}): React.ReactElement<any> {
  return (
    <div className="sw-Component-tooltip">
      <div
        style={{
          borderRadius: '50%',
          padding: '5px',
          width: '6px',
          height: '6px',
          backgroundColor: '#d5d5d5',
          display: ' flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <a data-for={props.id} data-tip={props.message}>
          ?
        </a>
        <ReactTooltip
          html={true}
          id={props.id}
          multiline={true}
          getContent={(dataTip): string => `${dataTip}`}
        />
      </div>
    </div>
  );
}

/**
 * A pure tsx component for a launcher card.
 *
 * @param label - Text for the Card
 * @param icon - Icon for the Card
 * @param isSelected - Helps to know the selected stack.
 * @param updateCallback - Callback to update stacks on other components
 * @returns a vdom `VirtualElement` for the launcher card.
 */
export function Card(props: {
  label: string;
  icon: LabIcon;
  isSelected?: boolean;
  updateCallback: (stack: string) => void;
}): React.ReactElement<any> {
  const title = props.label;
  // Build the onclick handler.
  const onclick = (): void => {
    // If an item has already been launched,
    // don't try to launch another.
    props.updateCallback(props.label);
  };

  const onkeypress = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter') {
      onclick();
    }
  };
  return (
    <div
      style={{
        height: '75px',
        width: '75px',
        border: props.isSelected ? '2px solid var(--jp-brand-color1)' : ''
      }}
      className="jp-LauncherCard"
      id={props.label}
      title={title}
      onClick={onclick}
      onKeyPress={onkeypress}
      tabIndex={100}
    >
      <div className="sw jp-LauncherCard-icon" style={{ paddingTop: '4px' }}>
        {
          <LabIcon.resolveReact
            icon={props.icon}
            iconClass={classes('', 'jp-Icon-cover')}
            stylesheet="launcherCard"
          />
        }
      </div>
      <div className="jp-LauncherCard-label" title={title}>
        <p>{props.label}</p>
      </div>
    </div>
  );
}
