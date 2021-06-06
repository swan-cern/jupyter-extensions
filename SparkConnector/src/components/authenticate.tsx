import React from 'react';
import { observer } from 'mobx-react-lite';

import Button from '@material-ui/core/Button';
import VpnKeyIcon from '@material-ui/icons/VpnKey';
import TextField from '@material-ui/core/TextField';
import Alert from '@material-ui/lab/Alert';
import AlertTitle from '@material-ui/lab/AlertTitle';

import { store } from '../store';
import { Layout, Section } from './common/layout';

export const Authenticate = observer(() => {
  const [password, setPassword] = React.useState('');
  let displayError: React.ReactNode = '';
  if (store.currentNotebook.authError) {
    displayError = (
      <Alert severity="error">
        <AlertTitle>Error</AlertTitle>
        {store.currentNotebook.authError}
      </Alert>
    );
  }
  return (
    <Layout>
      <Section title="Authentication" className="jp-SparkConnector-auth">
        {displayError}
        <Alert severity="info">
          Before connecting to the cluster, we need to obtain a Kerberos ticket.
          Please enter your account password.
        </Alert>

        <TextField
          id="standard-password-input"
          size="small"
          variant="outlined"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          fullWidth
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setPassword(event.target.value);
          }}
        />
      </Section>
      <Button
        color="primary"
        variant="contained"
        disabled={!password}
        onClick={() => {
          store.onClickAuthenticate(password);
        }}
        startIcon={<VpnKeyIcon />}
        className="jp-SparkConnector-button-main"
      >
        Authenticate
      </Button>
    </Layout>
  );
});
