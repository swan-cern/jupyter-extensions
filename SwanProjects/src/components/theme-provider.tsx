import React from 'react';
import {
  createTheme,
  ThemeProvider as MaterialUIThemeProvider,
} from '@material-ui/core/styles';

const createLightorDarkTheme = (color: 'light' | 'dark') => {
  return createTheme({
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
        main: '#0153a1',
      },
    },
  });
};

const lightTheme = createLightorDarkTheme('light');
const darkTheme = createLightorDarkTheme('dark');

export const ThemeProvider: React.FunctionComponent<{
  theme: 'light' | 'dark';
}> = (props) => {
  const currentTheme = props.theme === 'light' ? lightTheme : darkTheme;
  return (
    <MaterialUIThemeProvider theme={currentTheme}>
      {props.children}
    </MaterialUIThemeProvider>
  );
};
