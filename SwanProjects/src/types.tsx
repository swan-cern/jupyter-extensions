export interface ISWANStackNodeOptions {
  releases: { [release: string]: Array<string> };
  logo: string;
}

export interface ISWANStackOptions {
  stacks: { [stack: string]: ISWANStackNodeOptions };
}

export type ProjectData = {
  name?: string;
  full_path: string;
  stack: {
    type: 'LCG' | 'CMSSW' | 'FCCW' | 'default' | string;
    release?: string;
    platform?: string;
  };
  user_script: string;
};
