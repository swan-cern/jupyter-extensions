/**
 * A CERNBox share — either incoming (shared with me) or outgoing (shared by me).
 */
export interface IShare {
  id: string;
  /** Display name of the shared folder */
  name: string;
  /** EOS path to navigate to */
  path: string;
  /** 'incoming' = shared with me, 'outgoing' = shared by me */
  direction: 'incoming' | 'outgoing';
  /** The user who shared the folder (incoming) */
  sharedBy?: string;
  /** The user(s) the folder is shared with (outgoing) */
  sharedWith?: string[];
}

/**
 * Fetch the user's shares from CERNBox.
 *
 * TODO: Replace with a real CS3/CERNBox API call.
 */
export async function fetchShares(): Promise<IShare[]> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 300));

  return [
    // ── Shared with me ──────────────────────────────────────
    {
      id: 'share-in-1',
      name: 'trigger-studies',
      path: '/user/j/jdoe/trigger-studies',
      direction: 'incoming',
      sharedBy: 'jdoe'
    },
    {
      id: 'share-in-2',
      name: 'ml-pipeline',
      path: '/user/a/asmith/ml-pipeline',
      direction: 'incoming',
      sharedBy: 'asmith'
    },
    {
      id: 'share-in-3',
      name: 'beam-optics-2026',
      path: '/user/m/mrossi/beam-optics-2026',
      direction: 'incoming',
      sharedBy: 'mrossi'
    },
    // ── Shared by me ────────────────────────────────────────
    {
      id: 'share-out-1',
      name: 'Documents',
      path: '/user/t/troun/Documents',
      direction: 'outgoing',
      sharedWith: ['jdoe', 'asmith']
    },
    {
      id: 'share-out-2',
      name: 'Swan_projects',
      path: '/user/t/troun/SWAN_projects',
      direction: 'outgoing',
      sharedWith: ['mrossi']
    }
  ];
}
