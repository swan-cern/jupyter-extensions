import React from 'react';
import { observer } from 'mobx-react-lite';

import { store } from '../../store';
import { Section } from '../common/layout';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import CheckIcon from '@material-ui/icons/PlaylistAddCheck';
import AddIcon from '@material-ui/icons/PlaylistAdd';

export const ChooseBundles = observer(() => {
  const activeBundles = store.currentNotebook.selectedBundles;
  const availableBundles = store.currentNotebook.filteredAvailableBundles || [];
  const toggleBundle = (bundleName: string) => {
    if (activeBundles.indexOf(bundleName) === -1) {
      store.currentNotebook.addBundle(bundleName);
    } else {
      store.currentNotebook.removeBundle(bundleName);
    }
  };
  const bundleList = Object.keys(availableBundles).map((bundleName: string) => {
    const isSelected = activeBundles.indexOf(bundleName) !== -1;
    return (
      <ListItem
        key={bundleName}
        button
        selected={isSelected}
        onClick={() => {
          toggleBundle(bundleName);
        }}
      >
        <ListItemIcon>{isSelected ? <CheckIcon /> : <AddIcon />}</ListItemIcon>

        <ListItemText id={bundleName} primary={bundleName} />
      </ListItem>
    );
  });
  return (
    <Section title="Add Configuration Bundle">
      <List dense disablePadding>
        {bundleList}
      </List>
    </Section>
  );
});
