import React from 'react';

import { Dialog, showDialog } from '@jupyterlab/apputils';

import { ThemeProvider } from './theme-provider';

import ButtonBase from '@material-ui/core/ButtonBase';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import ListItemText from '@material-ui/core/ListItemText';
import Avatar from '@material-ui/core/Avatar';

export const Header = (props: {
  hubPrefix?: string;
  hubUser?: string;
  baseUrl: string;
}): React.ReactElement => {
  const userName = props.hubUser || 'swanuser';
  const changeConfigurationUrl = props.hubPrefix + 'home?changeconfig';

  const [menuAnchorElement, setMenuAnchorElement] = React.useState(null);
  const isMenuOpen = Boolean(menuAnchorElement);

  const handleOpenMenu = (event: any) => {
    setMenuAnchorElement(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setMenuAnchorElement(null);
  };

  const onChangeConfiguration = async () => {
    handleCloseMenu();
    const result = await showDialog({
      title: 'Change configuration?',
      body: 'Do you want to shut down your session and change configuration? This will close all notebooks and shutdown all running kernels.',
      buttons: [
        Dialog.okButton({
          caption: 'Shutdown',
          displayType: 'warn',
          label: 'Shutdown Session'
        }),
        Dialog.cancelButton({
          caption: 'Cancel',
          label: 'Cancel'
        })
      ]
    });
    if (result.button.accept) {
      window.location.replace(changeConfigurationUrl);
    }
  };

  const onClickLogout = async () => {
    handleCloseMenu();
    const result = await showDialog({
      title: 'Logout?',
      body: 'Do you want to logout? This will NOT shutdown your session or stop your running notebooks. However sessions that are idle for an extended period of time will automatically be shut down.',
      buttons: [
        Dialog.okButton({
          caption: 'Logout',
          label: 'Logout'
        }),
        Dialog.cancelButton({
          caption: 'Cancel',
          label: 'Cancel'
        })
      ]
    });
    if (result.button.accept) {
      window.location.replace(props.baseUrl + 'logout');
    }
  };

  return (
    <ThemeProvider>
      <div className="sw-header">
        <div className="sw-header-left">
          <div className="sw-swan-logo"></div>
        </div>
        <div className="sw-header-right">
          <ButtonBase
            className={
              'sw-avatar sw-nav-item' +
              (isMenuOpen ? ' sw-nav-item-selected' : '')
            }
            onClick={handleOpenMenu}
          >
            <Avatar className="sw-avatar-picture">
              {userName[0].toUpperCase()}
            </Avatar>
            <span className="sw-avatar-text">{userName}</span>
          </ButtonBase>
          <Menu
            className="sw-header-menu"
            anchorEl={menuAnchorElement}
            open={isMenuOpen}
            onClose={handleCloseMenu}
            variant={'menu'}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            getContentAnchorEl={null}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right'
            }}
          >
            <MenuItem button onClick={onClickLogout} dense divider>
              <ListItemText primary="Logout" />
            </MenuItem>
            <MenuItem button onClick={onChangeConfiguration} dense>
              <ListItemText primary="Change Configuration" />
            </MenuItem>
          </Menu>
        </div>
      </div>
    </ThemeProvider>
  );
};
