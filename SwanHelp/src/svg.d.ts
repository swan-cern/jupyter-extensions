// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

// including this file in a package allows for the use of import statements
// with svg files. Example: `import xSvg from 'path/xSvg.svg'`

declare module '*.svg' {
  const value: string;
  export default value;
}