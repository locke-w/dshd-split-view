/**
 * dshd-split-view 类型定义
 * 
 * 严格参照 Antigravity 2.0 Split View 架构设计，
 * 提供二叉树分屏、几何计算、拖拽热区判定及跨平台配置类型定义。
 * 
 * @author Locke (locke-w)
 */

export type SplitDirection = 'horizontal' | 'vertical';

export type DropPosition = 'left' | 'right' | 'top' | 'bottom' | 'center' | 'none';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LeafNode {
  kind: 'leaf';
  id: string;
  sessionId: string | null;
  title?: string;
  customName?: string;
}

export interface BranchNode {
  kind: 'branch';
  id: string;
  direction: SplitDirection;
  fraction: number; // 分割比例，范围通常为 (0, 1)，默认 0.5
  first: SplitNode;
  second: SplitNode;
}

export type SplitNode = LeafNode | BranchNode;

export interface LayoutState {
  tree: SplitNode;
  focusedPaneId: string;
  maximizedPaneId: string | null;
}

export interface ComputedPaneGeometry {
  id: string;
  sessionId: string | null;
  rect: Rect;
  focused: boolean;
  maximized: boolean;
}

export interface ComputedDividerGeometry {
  id: string;
  branchId: string;
  direction: SplitDirection;
  rect: Rect;
}

export interface LayoutGeometry {
  panes: ComputedPaneGeometry[];
  dividers: ComputedDividerGeometry[];
}

export interface DropZoneInfo {
  position: DropPosition;
  rect: Rect | null;
}

export interface SplitGroupSessionItem {
  id: string;
  title: string;
}

export interface SplitGroupSnapshot {
  id: string;
  name: string;
  createdAt: number;
  layout: LayoutState;
  paneTitles: Record<string, string>;
  sessions: SplitGroupSessionItem[];
  collapsed: boolean;
}

export type SupportedPlatform = 'macos' | 'windows' | 'linux';

export interface ShortcutDefinition {
  splitRight: string;
  splitDown: string;
  closePane: string;
  toggleMaximize: string;
  focusNext: string;
  focusPrev: string;
}
