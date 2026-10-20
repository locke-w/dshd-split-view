/**
 * dshd-split-view 跨平台适配器 (macOS & Windows)
 * 
 * 1. 自动嗅探客户端操作系统 (macOS / Windows / Linux)
 * 2. 映射原生按键语义 (Cmd ⌘ vs Ctrl)
 * 3. 避让窗口非客户区控制按键 (Traffic lights & Caption controls)
 * 
 * @author Locke (locke-w)
 */

import type { SupportedPlatform, ShortcutDefinition } from './types.ts';

export function detectCurrentPlatform(): SupportedPlatform {
  if (typeof process !== 'undefined' && process.platform) {
    if (process.platform === 'darwin') return 'macos';
    if (process.platform === 'win32') return 'windows';
    return 'linux';
  }
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac') || ua.includes('darwin')) return 'macos';
    if (ua.includes('win')) return 'windows';
  }
  return 'macos';
}

export function getPlatformShortcuts(platform: SupportedPlatform = detectCurrentPlatform()): ShortcutDefinition {
  const isMac = platform === 'macos';
  const mod = isMac ? '⌘' : 'Ctrl';
  const opt = isMac ? '⌥' : 'Alt';

  return {
    splitRight: `${mod}+${opt}+D`,
    splitDown: `${mod}+${opt}+V`,
    closePane: `${mod}+${opt}+W`,
    toggleMaximize: `${mod}+${opt}+Enter`,
    focusNext: `${mod}+${opt}+]`,
    focusPrev: `${mod}+${opt}+[`
  };
}

export interface PlatformWindowInsets {
  headerLeftPadding: number;
  headerRightPadding: number;
}

export function getPlatformWindowInsets(platform: SupportedPlatform = detectCurrentPlatform()): PlatformWindowInsets {
  if (platform === 'macos') {
    // macOS traffic light buttons (通常需要左侧避让约 78px，如果是 hiddenInset)
    return {
      headerLeftPadding: 78,
      headerRightPadding: 16
    };
  }
  if (platform === 'windows') {
    // Windows 右上角最小化/最大化/关闭按钮 (通常需要右侧避让约 138px)
    return {
      headerLeftPadding: 16,
      headerRightPadding: 138
    };
  }
  return {
    headerLeftPadding: 16,
    headerRightPadding: 16
  };
}
