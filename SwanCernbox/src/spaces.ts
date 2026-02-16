/**
 * A CERNBox Space (project) that the user has access to.
 */
export interface ISpace {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Optional description */
  description?: string;
  /**
   * Path relative to the ContentsManager root_dir (i.e. /eos).
   * Example: "/project/a/atlas-analysis"
   */
  path: string;
}

/**
 * Fetch the list of spaces the current user has access to.
 *
 * TODO: Replace with a real CS3/CERNBox API call.
 */
export async function fetchSpaces(): Promise<ISpace[]> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 300));

  return [
    {
      id: 'atlas-analysis',
      name: 'ATLAS Analysis',
      description: 'Shared analysis workspace for the ATLAS experiment',
      path: '/project/a/atlas-analysis'
    },
    {
      id: 'cms-opendata',
      name: 'CMS Open Data',
      description: 'Public datasets and analysis scripts for CMS open data',
      path: '/project/c/cms-opendata'
    },
    {
      id: 'it-swan-dev',
      name: 'SWAN Development',
      description: 'Internal development and testing for the SWAN team',
      path: '/project/s/swan-dev'
    },
    {
      id: 'theory-lattice',
      name: 'Lattice QCD',
      path: '/project/l/lattice'
    },
    {
      id: 'alice-qgp',
      name: 'ALICE QGP Studies',
      description: 'Quark-gluon plasma analysis notebooks and shared results',
      path: '/project/a/alice-qgp'
    }
  ];
}
