import React from 'react';
import { observer } from 'mobx-react-lite';

import { store } from '../../store';
import { Section } from '../common/layout';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Collapse from '@material-ui/core/Collapse';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import SettingsIcon from '@material-ui/icons/Settings';
import DeleteIcon from '@material-ui/icons/Delete';
import IconButton from '@material-ui/core/IconButton';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListSubheader from '@material-ui/core/ListSubheader';

const SelectedConfigurationItem = (props: {
  config: {
    name: string;
    value: string;
    isEnabled: boolean;
    id: string;
  };
  onClickRemove: () => void;
}) => {
  return (
    <ListItem dense key={props.config.id}>
      <ListItemIcon>
        <SettingsIcon />
      </ListItemIcon>
      <ListItemText
        primary={props.config.name}
        secondary={props.config.value}
      />
      <ListItemSecondaryAction>
        <IconButton edge="end" size="small" onClick={props.onClickRemove}>
          <DeleteIcon />
        </IconButton>
      </ListItemSecondaryAction>
    </ListItem>
  );
};

const SelectedBundleItem = observer((props: { bundleName: string }) => {
  const [expanded, setExpanded] = React.useState(true);
  const configList = store.currentNotebook.filteredAvailableBundles[
    props.bundleName
  ]?.options?.map((config, index) => (
    <ListItem dense key={index}>
      <ListItemIcon>
        <SettingsIcon />
      </ListItemIcon>
      <ListItemText primary={config['name']} secondary={config['value']} />
    </ListItem>
  ));
  return (
    <>
      <ListItem
        dense
        button
        divider
        onClick={() => {
          setExpanded(!expanded);
        }}
        key={props.bundleName}
      >
        <ListItemIcon>
          <IconButton
            aria-label="delete"
            size="small"
            onClick={() => {
              store.currentNotebook.removeBundle(props.bundleName);
            }}
          >
            <DeleteIcon />
          </IconButton>
        </ListItemIcon>

        <ListItemText primary={<b>{props.bundleName}</b>} />
        {expanded ? <ExpandLess /> : <ExpandMore />}
      </ListItem>
      <Collapse in={expanded} timeout="auto">
        <List component="div" disablePadding dense>
          {configList}
        </List>
      </Collapse>
    </>
  );
});

export const SelectedConfiguration = observer(() => {
  const bundles = store.currentNotebook.selectedBundles.map((bundleName) => {
    return <SelectedBundleItem bundleName={bundleName} key={bundleName} />;
  });

  const options = store.currentNotebook.selectedConfigurations.map((option) => {
    return (
      <SelectedConfigurationItem
        config={option}
        onClickRemove={() => {
          store.currentNotebook.removeConfiguration(option.id);
        }}
        key={option.id}
      />
    );
  });

  return (
    <Section
      title="Selected Configuration"
      className="jp-SparkConnector-selected-config"
    >
      <List dense disablePadding>
        {bundles}
        {options.length > 0 && (
          <ListSubheader>Extra Configuration</ListSubheader>
        )}
        {options}
      </List>
    </Section>
  );
});
