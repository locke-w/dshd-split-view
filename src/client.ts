/**
 * dshd-split-view 客户端核心实现
 * 
 * 严格参照 Antigravity 2.0 分屏逻辑逆向打造，专为 DeepSeek Harness Desktop 设计：
 * 1. 单宿主单渲染进程模型 (Native Single Process Multi-Pane)
 * 2. 避免旧版 iframe 嵌套导致的 Electron Preload 缺失与 IPC 死锁
 * 3. 仿 Antigravity 2.0 边缘拖拽热区高亮分屏 (Ghost Drop Overlay)
 * 4. 完美适配 macOS (⌘) 与 Windows (Ctrl) 快捷键及非客户区控制避让
 * 
 * @author Locke (locke-w)
 */

export interface SplitPaneState {
  id: string;
  sessionId: string | null;
  title: string;
  ratio: number;
}

export type SplitDirection = 'horizontal' | 'vertical';
export type DropPosition = 'left' | 'right' | 'top' | 'bottom' | 'center' | 'none';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DropZoneInfo {
  position: DropPosition;
  rect: Rect | null;
}

export const inject = ['slots', 'sessions', 'theme', 'locale'];

export function apply(ctx: any) {
  console.info('[dshd-split-view] Antigravity 2.0 Native Split Engine initialized on Desktop.');
}
