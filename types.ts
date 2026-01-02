
export interface ScriptSegment {
  id: string;
  title: string;
  timeRange: string;
  visualPrompt: string;
  audioSfx: string;
  voicemail: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  voiceSpeed?: number;
  voicePitch?: 'low' | 'normal' | 'high';
  stage?: number;
}

export interface ScriptData {
  topic: string;
  segments: ScriptSegment[];
}

export enum AppState {
  START = 'START',
  KEY_SELECTION = 'KEY_SELECTION',
  EDITOR = 'EDITOR',
  GENERATING_VIDEO = 'GENERATING_VIDEO'
}

export enum ViewMode {
  CODEX = 'CODEX',
  STUDIO = 'STUDIO'
}
