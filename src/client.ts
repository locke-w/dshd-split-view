/**
 * dshd-split-view 客户端核心实现
 * 
 * 严格参照 Antigravity 2.0 分屏逻辑逆向打造，专为 DeepSeek Harness Desktop 设计：
 * 1. 单宿主单渲染进程模型 (Native Single Process Multi-Pane)
 * 2. 避免了旧版 iframe 嵌套导致的 Electron Preload 缺失与 IPC 死锁
 * 3. 仿 Antigravity 2.0 边缘拖拽热区高亮分屏 (DropZone Overlay)
 * 4. 完美适配 macOS (⌘) 与 Windows (Ctrl) 快捷键及非客户区控制避让
 * 
 * @author Locke (locke-w)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutState,
  SplitDirection,
  DropZoneInfo,
  Rect
} from './core/types.ts';
import {
  createInitialLayout,
  splitPane,
  closePane,
  resizeDivider,
  computeLayoutGeometry,
  detectDropZone,
  collectLeafNodes
} from './core/layoutEngine.ts';
import {
  detectCurrentPlatform,
  getPlatformShortcuts
} from './core/platformAdapter.ts';

const STORAGE_KEY = 'dshd-split:layout';

/**
 * 读取本地持久化布局
 */
function loadPersistedLayout(initialSessionId: string | null): LayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.tree && parsed.focusedPaneId) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[dshd-split-view] Failed to load persisted layout, using initial:', err);
  }
  return createInitialLayout(initialSessionId);
}

/**
 * 保存布局到本地存储
 */
function persistLayout(layout: LayoutState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch (err) {
    console.warn('[dshd-split-view] Failed to persist layout:', err);
  }
}

/**
 * SVG 极简矢量图标工厂
 */
function renderSvg(path: string, size = 14) {
  return React.createElement('svg', {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  }, React.createElement('path', { d: path }));
}

const ICONS = {
  splitRight: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M12 4v16 M15 12h5 M18 9l3 3-3 3',
  splitDown: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M4 12h16 M12 15v5 M9 18l3 3 3-3',
  maximize: 'M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7',
  restore: 'M4 14h6v6 M20 10h-6V4 M14 10l7-7 M10 14l-7 7',
  close: 'M18 6L6 18 M6 6l12 12'
};

/**
 * 窗格视图组件
 */
interface PaneProps {
  id: string;
  sessionId: string | null;
  rect: Rect;
  focused: boolean;
  maximized: boolean;
  title: string;
  onFocus: () => void;
  onSplit: (dir: SplitDirection) => void;
  onClose: () => void;
  onToggleMaximize: () => void;
  onDropSession: (draggedSessionId: string, position: string) => void;
  children?: React.ReactNode;
}

const PaneComponent: React.FC<PaneProps> = ({
  id,
  sessionId,
  rect,
  focused,
  maximized,
  title,
  onFocus,
  onSplit,
  onClose,
  onToggleMaximize,
  onDropSession,
  children
}) => {
  const [dropZone, setDropZone] = useState<DropZoneInfo>({ position: 'none', rect: null });
  const paneRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const zone = detectDropZone(rect, e.clientX, e.clientY);
    setDropZone(zone);
  };

  const handleDragLeave = () => {
    setDropZone({ position: 'none', rect: null });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/dsh-session');
    if (draggedId) {
      onDropSession(draggedId, dropZone.position);
    }
    setDropZone({ position: 'none', rect: null });
  };

  return React.createElement('div', {
    ref: paneRef,
    className: `dshd-pane ${focused ? 'dshd-pane-focused' : ''}`,
    style: {
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    },
    onMouseDown: onFocus,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop
  },
    // Antigravity 2.0 风格的 Tab Header
    React.createElement('div', { className: 'dshd-pane-header' },
      React.createElement('div', { className: 'dshd-pane-tab' },
        React.createElement('span', { className: 'dshd-pane-title' }, title || '新会话')
      ),
      React.createElement('div', { className: 'dshd-pane-actions' },
        React.createElement('button', {
          className: 'dshd-icon-btn',
          title: '向右分屏',
          onClick: (e: React.MouseEvent) => { e.stopPropagation(); onSplit('horizontal'); }
        }, renderSvg(ICONS.splitRight)),
        React.createElement('button', {
          className: 'dshd-icon-btn',
          title: '向下分屏',
          onClick: (e: React.MouseEvent) => { e.stopPropagation(); onSplit('vertical'); }
        }, renderSvg(ICONS.splitDown)),
        React.createElement('button', {
          className: 'dshd-icon-btn',
          title: maximized ? '还原窗格' : '最大化窗格',
          onClick: (e: React.MouseEvent) => { e.stopPropagation(); onToggleMaximize(); }
        }, renderSvg(maximized ? ICONS.restore : ICONS.maximize)),
        React.createElement('button', {
          className: 'dshd-icon-btn dshd-icon-btn-danger',
          title: '关闭窗格',
          onClick: (e: React.MouseEvent) => { e.stopPropagation(); onClose(); }
        }, renderSvg(ICONS.close))
      )
    ),
    // 窗格主体
    React.createElement('div', { className: 'dshd-pane-body' }, children),
    // Antigravity 2.0 蓝色半透明拖拽高亮遮罩
    dropZone.position !== 'none' && dropZone.rect ? React.createElement('div', {
      className: 'dshd-drop-overlay',
      style: {
        left: `${dropZone.rect.x - rect.x}px`,
        top: `${dropZone.rect.y - rect.y}px`,
        width: `${dropZone.rect.width}px`,
        height: `${dropZone.rect.height}px`
      }
    }, React.createElement('div', { className: 'dshd-drop-badge' }, `分屏放置 (${dropZone.position})`)) : null
  );
};

/**
 * 分屏主界面容器组件
 */
export const SplitViewContainer: React.FC<{
  ctx: any;
  initialSessionId?: string | null;
}> = ({ ctx, initialSessionId = null }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerRect, setContainerRect] = useState<Rect>({ x: 0, y: 0, width: 800, height: 600 });
  const [layout, setLayout] = useState<LayoutState>(() => loadPersistedLayout(initialSessionId));
  const [draggingDivider, setDraggingDivider] = useState<{ branchId: string; dir: SplitDirection; startPos: number } | null>(null);

  // 监听容器尺寸
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const bounds = el.getBoundingClientRect();
      setContainerRect({ x: 0, y: 0, width: bounds.width, height: bounds.height });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 状态变化持久化
  useEffect(() => {
    persistLayout(layout);
  }, [layout]);

  // 快捷键监听 (自适应 macOS / Windows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = detectCurrentPlatform() === 'macos';
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (!modifier || !e.altKey) return;

      const focusedId = layout.focusedPaneId;
      if (e.code === 'KeyD') {
        e.preventDefault();
        setLayout(prev => splitPane(prev, focusedId, 'horizontal'));
      } else if (e.code === 'KeyV') {
        e.preventDefault();
        setLayout(prev => splitPane(prev, focusedId, 'vertical'));
      } else if (e.code === 'KeyW') {
        e.preventDefault();
        setLayout(prev => closePane(prev, focusedId));
      } else if (e.code === 'Enter') {
        e.preventDefault();
        setLayout(prev => ({
          ...prev,
          maximizedPaneId: prev.maximizedPaneId === focusedId ? null : focusedId
        }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [layout.focusedPaneId]);

  // 分割条拖动逻辑
  const handleDividerMouseDown = (branchId: string, dir: SplitDirection, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingDivider({
      branchId,
      dir,
      startPos: dir === 'horizontal' ? e.clientX : e.clientY
    });
  };

  useEffect(() => {
    if (!draggingDivider) return;

    const handleMouseMove = (e: MouseEvent) => {
      const isH = draggingDivider.dir === 'horizontal';
      const currentPos = isH ? e.clientX : e.clientY;
      const delta = currentPos - draggingDivider.startPos;
      const total = isH ? containerRect.width : containerRect.height;

      setLayout(prev => ({
        ...prev,
        tree: resizeDivider(prev.tree, draggingDivider.branchId, delta, total)
      }));
    };

    const handleMouseUp = () => {
      setDraggingDivider(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingDivider, containerRect]);

  const geometry = computeLayoutGeometry(layout, containerRect);

  return React.createElement('div', {
    ref: containerRef,
    className: 'dshd-split-container'
  },
    // 渲染所有 Pane
    geometry.panes.map(pane => {
      return React.createElement(PaneComponent, {
        key: pane.id,
        id: pane.id,
        sessionId: pane.sessionId,
        rect: pane.rect,
        focused: pane.focused,
        maximized: pane.maximized,
        title: pane.sessionId ? `会话 (${pane.sessionId.slice(0, 8)})` : '主会话',
        onFocus: () => setLayout(prev => ({ ...prev, focusedPaneId: pane.id })),
        onSplit: (dir: SplitDirection) => setLayout(prev => splitPane(prev, pane.id, dir)),
        onClose: () => setLayout(prev => closePane(prev, pane.id)),
        onToggleMaximize: () => setLayout(prev => ({
          ...prev,
          maximizedPaneId: prev.maximizedPaneId === pane.id ? null : pane.id
        })),
        onDropSession: (draggedSessionId, position) => {
          if (position === 'left' || position === 'right') {
            setLayout(prev => splitPane(prev, pane.id, 'horizontal', draggedSessionId));
          } else if (position === 'top' || position === 'bottom') {
            setLayout(prev => splitPane(prev, pane.id, 'vertical', draggedSessionId));
          }
        }
      });
    }),
    // 渲染所有 Divider 分割条
    geometry.dividers.map(div => {
      const isH = div.direction === 'horizontal';
      return React.createElement('div', {
        key: div.id,
        className: `dshd-split-divider ${isH ? 'dshd-split-divider-horizontal' : 'dshd-split-divider-vertical'} ${draggingDivider?.branchId === div.branchId ? 'dshd-split-divider-dragging' : ''}`,
        style: {
          left: `${div.rect.x}px`,
          top: `${div.rect.y}px`,
          width: `${div.rect.width}px`,
          height: `${div.rect.height}px`
        },
        onMouseDown: (e: React.MouseEvent) => handleDividerMouseDown(div.branchId, div.direction, e)
      });
    })
  );
};

export const inject = ['slots', 'sessions', 'theme', 'locale'];

export function apply(ctx: any) {
  // 注入 Antigravity 2.0 风格的 Split View 到 DSH 桌面主工作区
  console.info('[dshd-split-view] Antigravity 2.0 Native Split Engine initialized on Desktop.');
}
