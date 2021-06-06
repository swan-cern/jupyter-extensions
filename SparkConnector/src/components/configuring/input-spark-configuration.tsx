import React from 'react';
import TextField from '@material-ui/core/TextField';
import Autocomplete from '@material-ui/lab/Autocomplete';
import { Button } from '@material-ui/core';
import { observer } from 'mobx-react-lite';
import { store } from '../../store';
import AddIcon from '@material-ui/icons/Add';
import { Section } from '../common/layout';

export const InputSparkConfiguration = observer(() => {
  const options = store.availableOptions || [];
  const [selectedSuggestion, setSelectedSuggestion] = React.useState<any>(null);
  const [configurationName, setConfigurationName] = React.useState('');
  const [value, setValue] = React.useState('');
  return (
    <Section title="Add Extra Configuration">
      <ul>
        <li>
          You can configure the following{' '}
          <a
            href="https://spark.apache.org/docs/latest/configuration#available-properties"
            target="_blank"
            rel="noreferrer"
          >
            options.
          </a>
        </li>
        <li>These options override options in the selected bundles.</li>
        <li>Environment variables can be used via {'{ENV_VAR_NAME}'}.</li>
      </ul>
      <div className="jp-SparkConnector-input-sparkopts">
        <Autocomplete
          size="small"
          freeSolo
          options={options}
          inputValue={configurationName}
          onInputChange={(_, newName) => {
            setConfigurationName(newName);
          }}
          value={selectedSuggestion}
          onChange={(_, newValue) => {
            setSelectedSuggestion(newValue);
          }}
          disableClearable
          groupBy={(option) => option.data.category}
          getOptionLabel={(option) => {
            if (typeof option === 'string') {
              return option;
            }
            return option.value;
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Configuration Name"
              variant="outlined"
              size="small"
            />
          )}
        />
        <TextField
          label="Value"
          size="small"
          variant="outlined"
          value={value}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setValue(event.target.value);
          }}
        />
        <Button
          startIcon={<AddIcon />}
          disabled={!configurationName || !value}
          variant="contained"
          onClick={() => {
            store.currentNotebook.addConfiguration(configurationName, value);
            setConfigurationName('');
            setValue('');
          }}
        >
          Add Configuration
        </Button>
      </div>
    </Section>
  );
});
