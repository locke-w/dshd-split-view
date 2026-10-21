/**
 * dshd-split-view 客户端核心实现
 * 
 * 严格参照 Antigravity 2.0 分屏逻辑逆向打造，专为 DeepSeek Harness Desktop 设计：
 * 1. 单宿主单渲染进程模型 (Native Single Process Multi-Pane)
 * 2. 避免旧版 iframe 嵌套导致的 Electron Preload 缺失与 IPC 死锁
 * 3. 仿 Antigravity 2.0 边缘拖拽热区高亮分屏 (Ghost Drop Overlay)
 * 4. 支持任意二叉树多窗格分屏 (左右水平分屏、上下垂直分屏、2x2 田字格、多列嵌套)
 * 5. 侧边栏会话右键菜单无缝注入「分屏 (Split) > 向右分屏 / 向下分屏」
 * 6. 完美适配 macOS (⌘) 与 Windows (Ctrl) 快捷键及非客户区控制避让
 * 
 * @author Locke (locke-w)
 */

import type {
  SplitNode,
  LeafNode,
  BranchNode,
  LayoutState,
  Rect,
  LayoutGeometry,
  ComputedPaneGeometry,
  ComputedDividerGeometry,
  SplitDirection,
  DropZoneInfo,
  DropPosition
} from './core/types.ts';

export * from './core/types.ts';
export * from './core/layoutEngine.ts';
export * from './core/platformAdapter.ts';

export const inject = ['slots', 'sessions', 'theme', 'locale'];

export interface ActiveDragSession {
  id: string;
  title: string;
}

export declare class SplitViewController {
  layout: LayoutState | null;
  paneTitles: Record<string, string>;
  paneElements: Map<string, HTMLElement>;
  paneFrames: Map<string, HTMLIFrameElement>;
  baseHtml: string | null;
  activeDragSession: ActiveDragSession | null;
  lastContextSession: ActiveDragSession | null;
  mainEl: HTMLElement | null;
  containerEl: HTMLElement | null;
  draggingDivider: any | null;
  resizeObserver: ResizeObserver | null;

  init(): Promise<void>;
  initBaseHtml(): Promise<string>;
  generatePaneSrcDoc(paneId: string, sessionId: string): string;
  restoreLayout(): void;
  saveLayout(): void;
  detectCurrentSession(): ActiveDragSession;
  getSessionInfo(sessionId: string): ActiveDragSession;
  setupSidebarClickListener(): void;
  setupContextMenuObserver(): void;
  getCenterColumn(): HTMLElement | null;
  setupDndListeners(): void;
  showDropOverlay(rect: Rect, title: string, hint: string): void;
  hideDropOverlay(): void;
  handleDropAction(targetPaneId: string, position: DropPosition, sessionId: string, title?: string): void;
  splitPane(targetPaneId: string, direction: SplitDirection, newSessionId?: string | null, newTitle?: string, insertBefore?: boolean): Promise<void>;
  closePane(targetPaneId: string): void;
  toggleMaximize(targetPaneId: string): void;
  focusPane(targetPaneId: string): void;
  switchPaneSession(paneId: string, sessionId: string, title?: string): void;
  setupKeyboardListeners(): void;
  mountOrUpdateContainer(): void;
  renderLayoutGeometry(): void;
  startDividerDrag(e: MouseEvent, branchId: string, direction: SplitDirection, totalSize: number): void;
}

export function apply(ctx: any): void {
  console.info('[dshd-split-view] Antigravity 2.0 Native Multi-Pane Split Engine initialized on DeepSeek Harness Desktop.');
}
