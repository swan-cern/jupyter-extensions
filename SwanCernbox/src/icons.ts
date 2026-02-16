import { LabIcon } from '@jupyterlab/ui-components';

/**
 * CERNBox spaces icon (used for the spaces sidebar tab)
 */
export const spacesIcon = new LabIcon({
  name: '@swan-cern/swancernbox:spaces',
  svgstr: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path xmlns="http://www.w3.org/2000/svg" d="M22 12.999V20C22 20.5523 21.5523 21 21 21H13V12.999H22ZM11 12.999V21H3C2.44772 21 2 20.5523 2 20V12.999H11ZM11 3V10.999H2V4C2 3.44772 2.44772 3 3 3H11ZM21 3C21.5523 3 22 3.44772 22 4V10.999H13V3H21Z"></path></svg>`
});

/**
 * CERNBox share icon (used for the shares sidebar tab)
 */
export const shareIcon = new LabIcon({
  name: '@swan-cern/swancernbox:shares',
  svgstr: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path xmlns="http://www.w3.org/2000/svg" d="M13 14H11C7.54202 14 4.53953 15.9502 3.03239 18.8107C3.01093 18.5433 3 18.2729 3 18C3 12.4772 7.47715 8 13 8V3L23 11L13 19V14Z"></path></svg>`
});
