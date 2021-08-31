import React from 'react';
import {
  createTheme,
  ThemeProvider as MaterialUIThemeProvider
} from '@material-ui/core/styles';

const createLightorDarkTheme = (color: 'light' | 'dark') => {
  return createTheme({
    shape: {
      borderRadius: 0
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
        '"Segoe UI Symbol"'
      ].join(',')
    },
    palette: {
      type: color || 'light',
      text: {
        primary: '#dadada'
      },
      primary: {
        main: '#0153a1',
        contrastText: '#dadada'
      },
      error: {
        main: '#b70901'
      }
    }
  });
};

const lightTheme = createLightorDarkTheme('light');
const darkTheme = createLightorDarkTheme('dark');

export const ThemeProvider: React.FunctionComponent<{
  theme?: 'light' | 'dark';
}> = props => {
  const currentTheme = props.theme === 'dark' ? darkTheme : lightTheme;
  return (
    <MaterialUIThemeProvider theme={currentTheme}>
      {props.children}
    </MaterialUIThemeProvider>
  );
};
