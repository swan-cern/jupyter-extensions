import React from 'react';
import { classes, LabIcon } from '@jupyterlab/ui-components';


/**
 * A pure tsx component for a ProjectDialog card.
 *
 * @param label - Text for the Card
 * @param icon - Icon for the Card
 * @param isSelected - Helps to know the selected stack.
 * @param updateCallback - Callback to update stacks on other components
 * @returns a vdom `VirtualElement` for the ProjectDialog card.
 */
export function ProjectDialogCard(props: {
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
      // this style can not be moved to the css file,
      // because depends on the object props to check if the card is selected or not.
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
