
export interface Asset {
  id: string;
  name: string;
  category: 'IDENTITY' | 'UI' | 'FX' | 'OBJECT';
  prompt: string;
  icon: string;
}

export const VISUAL_ASSETS: Asset[] = [
  {
    id: 'kain_skull',
    name: 'KAIN Skull',
    category: 'IDENTITY',
    prompt: 'Minimalist white wireframe skull logo centered on void black background, glitching red eyes, cyberpunk noir style',
    icon: '💀'
  },
  {
    id: 'glitch_trans',
    name: 'Glitch FX',
    category: 'FX',
    prompt: 'Heavy datamoshing transition, pixel sorting, RGB split distortion, screen tearing effect, digital noise',
    icon: '⚡'
  },
  {
    id: 'terminal_ui',
    name: 'Terminal UI',
    category: 'UI',
    prompt: 'Retro CRT monitor booting up, green command line text scrolling fast, system initialization sequence, scanlines',
    icon: '💻'
  },
  {
    id: 'lock_secured',
    name: 'Secure Lock',
    category: 'OBJECT',
    prompt: 'Glowing neon blue padlock icon closing, digital chains forming, high contrast security verification UI',
    icon: '🔒'
  },
  {
    id: 'red_alert',
    name: 'Red Alert',
    category: 'UI',
    prompt: 'Flashing red WARNING text, critical error hex codes, alarm aesthetic, void black background',
    icon: '🚨'
  },
  {
    id: 'bio_scan',
    name: 'Bio Scan',
    category: 'UI',
    prompt: 'Biometric fingerprint scan animation, red laser grid, identity verification failure, hud elements',
    icon: '🆔'
  },
  {
    id: 'network_map',
    name: 'Net Map',
    category: 'UI',
    prompt: '3D wireframe network topology map, nodes connecting with laser lines, cyber threat intelligence dashboard',
    icon: '🕸️'
  },
  {
    id: 'hoodie_hacker',
    name: 'Phantom',
    category: 'IDENTITY',
    prompt: 'Silhouette of a hacker in a hoodie, face obscured by shadow, backlit by screens, cinematic lighting',
    icon: '👤'
  }
];
