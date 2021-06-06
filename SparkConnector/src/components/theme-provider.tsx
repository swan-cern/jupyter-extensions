import React from 'react';
import {
  createMuiTheme,
  ThemeProvider as MaterialUIThemeProvider,
} from '@material-ui/core/styles';
import { observer } from 'mobx-react-lite';
import { store } from '../store';

const createTheme = (color: 'light' | 'dark') => {
  return createMuiTheme({
    shadows: Array(25).fill('none') as any,
    shape: {
      borderRadius: 2,
    },
    typography: {
      fontSize: 12,
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
      ].join(','),
    },
    palette: {
      type: color || 'light',
      primary: {
        main: '#2196f3',
      },
    },
  });
};

const lightTheme = createTheme('light');
const darkTheme = createTheme('dark');

export const ThemeProvider = observer((props: any) => {
  const currentTheme = store.colorTheme === 'light' ? lightTheme : darkTheme;
  return (
    <MaterialUIThemeProvider theme={currentTheme}>
      {props.children}
    </MaterialUIThemeProvider>
  );
});
