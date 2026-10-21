/**
 * dshd-split-view - Antigravity 2.0 Native Multi-Session Split View
 * 
 * 专为 DeepSeek Harness Desktop (macOS & Windows) 打造的原生多会话分屏插件。
 * 严格参照 Antigravity 2.0 分屏交互模型与状态机架构设计：
 * 1. 任意二叉树嵌套分屏：支持上下分屏、左右分屏、田字格(2x2)及任意多窗格并列
 * 2. 侧边栏会话右键菜单扩展：深度集成 Antigravity 2.0 风格的「分屏 (Split) > 向右分屏 / 向下分屏」子菜单
 * 3. 任意窗格边缘拖拽热区判定与半透明蓝色高亮遮罩 (Ghost Drop Overlay)
 * 4. 多分割条独立平滑拖拽缩放与持久化记忆
 * 5. 自动适配 macOS (⌘) 与 Windows (Ctrl) 原生快捷键
 * 
 * @author Locke (locke-w)
 * @license MIT
 */

(function () {
  function factory(require) {
    var module = { exports: {} };
    var exports = module.exports;

    const STORAGE_KEY = 'dshd-split:layout:v3';
    const DEFAULT_DIVIDER_SIZE = 5;
    const MIN_PANE_SIZE = 140;

    /* =========================================================================
     * 1. 样式定义与动态注入 (Antigravity 2.0 视觉规范)
     * ========================================================================= */
    const CSS_STYLES = `
:root {
  --dshd-brand-primary: #3b82f6;
  --dshd-brand-hover: #2563eb;
  --dshd-brand-ghost: rgba(59, 130, 246, 0.15);
  --dshd-brand-dropzone: rgba(59, 130, 246, 0.22);
  --dshd-brand-dropborder: rgba(59, 130, 246, 0.85);

  --dshd-border-default: rgba(255, 255, 255, 0.08);
  --dshd-border-hover: rgba(59, 130, 246, 0.45);
  --dshd-border-focus: #3b82f6;

  --dshd-bg-root: #0e1015;
  --dshd-bg-pane: #12141a;
  --dshd-bg-header: #161822;
  --dshd-bg-tab-active: #1c1f2b;
  --dshd-bg-tab-hover: #181b24;

  --dshd-text-primary: #f3f4f6;
  --dshd-text-secondary: #9ca3af;
  --dshd-text-muted: #6b7280;

  --dshd-divider-bg: rgba(255, 255, 255, 0.07);
  --dshd-divider-hover: #3b82f6;
  --dshd-divider-active: #2563eb;
}

@media (prefers-color-scheme: light) {
  :root {
    --dshd-border-default: rgba(0, 0, 0, 0.09);
    --dshd-border-hover: rgba(59, 130, 246, 0.45);
    --dshd-bg-root: #f7f6f3;
    --dshd-bg-pane: #ffffff;
    --dshd-bg-header: #fbfbfa;
    --dshd-bg-tab-active: #ffffff;
    --dshd-bg-tab-hover: rgba(0, 0, 0, 0.04);
    --dshd-text-primary: #1f1e1d;
    --dshd-text-secondary: #63625e;
    --dshd-text-muted: #9b9a95;
    --dshd-divider-bg: rgba(0, 0, 0, 0.08);
  }
}

/* 分屏根容器 */
#dshd-split-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
  background-color: var(--dshd-bg-root);
}

/* 单个分屏卡片 */
.dshd-pane {
  position: absolute;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background-color: var(--dshd-bg-pane);
  border: 1px solid var(--dshd-border-default);
  border-radius: 6px;
  overflow: hidden;
  transition: border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1),
              z-index 0.15s ease;
  z-index: 1;
}

/* 鼠标悬停到任意会话框：立体浮起与微光阴影选中效果 */
.dshd-pane:hover {
  border-color: rgba(59, 130, 246, 0.5) !important;
  box-shadow: 0 4px 18px -2px rgba(0, 0, 0, 0.12),
              0 0 0 1.5px rgba(59, 130, 246, 0.35) !important;
  z-index: 3;
}

/* 激活聚焦状态下的窗格：高质感深邃阴影与外发光 */
.dshd-pane-focused {
  border-color: var(--dshd-border-focus) !important;
  box-shadow: 0 6px 24px -2px rgba(0, 0, 0, 0.16),
              0 0 0 2px var(--dshd-brand-primary) !important;
  z-index: 4;
}

.dshd-pane-focused:hover {
  border-color: var(--dshd-border-focus) !important;
  box-shadow: 0 8px 30px -3px rgba(0, 0, 0, 0.22),
              0 0 0 2.5px var(--dshd-brand-primary) !important;
  z-index: 5;
}

/* 深色模式下的阴影强化 */
@media (prefers-color-scheme: dark) {
  .dshd-pane:hover {
    border-color: rgba(96, 165, 250, 0.6) !important;
    box-shadow: 0 8px 28px -4px rgba(0, 0, 0, 0.55),
                0 0 0 1.5px rgba(96, 165, 250, 0.4) !important;
  }
  .dshd-pane-focused {
    border-color: var(--dshd-border-focus) !important;
    box-shadow: 0 10px 32px -4px rgba(0, 0, 0, 0.65),
                0 0 0 2px var(--dshd-brand-primary) !important;
  }
  .dshd-pane-focused:hover {
    box-shadow: 0 12px 38px -4px rgba(0, 0, 0, 0.75),
                0 0 0 2.5px var(--dshd-brand-primary) !important;
  }
}

/* 窗格顶部导航条 */
.dshd-pane-header {
  height: 38px;
  min-height: 38px;
  background-color: var(--dshd-bg-header);
  border-bottom: 1px solid var(--dshd-border-default);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 10px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  user-select: none;
  z-index: 5;
  transition: background-color 0.15s ease;
}

.dshd-pane:not(.dshd-pane-focused):hover .dshd-pane-header {
  background-color: var(--dshd-bg-tab-hover);
}

.dshd-pane-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: calc(100% - 136px);
  padding: 3px 8px;
  border-radius: 6px;
  background-color: var(--dshd-bg-tab-active);
  border: 1px solid var(--dshd-border-default);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--dshd-text-primary);
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.dshd-pane-tab:hover {
  background-color: var(--dshd-bg-tab-hover);
  border-color: rgba(59, 130, 246, 0.35);
}

.dshd-focus-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--dshd-brand-primary);
  box-shadow: 0 0 6px var(--dshd-brand-primary);
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.dshd-pane:not(.dshd-pane-focused) .dshd-focus-dot {
  background-color: var(--dshd-text-muted);
  box-shadow: none;
  opacity: 0.4;
}

.dshd-pane-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.dshd-pane-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.dshd-action-divider {
  width: 1px;
  height: 14px;
  background-color: var(--dshd-border-default);
  margin: 0 3px;
  flex-shrink: 0;
}

.dshd-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: var(--dshd-text-secondary);
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
  padding: 0;
}

.dshd-icon-btn:hover {
  background-color: var(--dshd-bg-tab-hover);
  color: var(--dshd-text-primary);
  transform: scale(1.05);
}

.dshd-icon-btn:active {
  transform: scale(0.96);
}

/* 右上角专属关闭 X 按钮 */
.dshd-pane-close-btn {
  color: var(--dshd-text-secondary);
}

.dshd-pane-close-btn:hover {
  background-color: rgba(239, 68, 68, 0.15) !important;
  color: #ef4444 !important;
  transform: scale(1.08) !important;
}

.dshd-pane-close-btn:active {
  transform: scale(0.95) !important;
}

/* 窗格主体内容区域 */
.dshd-pane-body {
  flex: 1 1 auto;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: calc(100% - 38px);
}

/* 未激活窗格的点击捕获浮层 */
.dshd-pane-click-capture {
  position: absolute;
  inset: 0;
  z-index: 10;
  cursor: pointer;
  background: transparent;
}

/* 未激活窗格的居中占位卡片 */
.dshd-pane-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  padding: 20px;
  user-select: none;
}

.dshd-placeholder-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px 24px;
  border-radius: 10px;
  background: var(--dshd-bg-header);
  border: 1px solid var(--dshd-border-default);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  max-width: 85%;
  text-align: center;
}

.dshd-pane:hover .dshd-placeholder-card {
  border-color: rgba(59, 130, 246, 0.35);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.1);
  transform: translateY(-2px);
}

.dshd-placeholder-icon {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--dshd-brand-ghost);
  color: var(--dshd-brand-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dshd-placeholder-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--dshd-text-primary);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshd-placeholder-hint {
  font-size: 11.5px;
  color: var(--dshd-text-muted);
}

/* 分割线 */
.dshd-split-divider {
  position: absolute;
  z-index: 8;
  background-color: var(--dshd-divider-bg);
  transition: background-color 0.15s ease;
  box-sizing: border-box;
}

.dshd-split-divider:hover {
  background-color: var(--dshd-divider-hover) !important;
}

.dshd-split-divider-dragging {
  background-color: var(--dshd-divider-active) !important;
}

.dshd-divider-h {
  cursor: col-resize;
}

.dshd-divider-v {
  cursor: row-resize;
}

/* Antigravity 2.0 边缘拖拽热区 Ghost 提示遮罩 */
#dshd-drop-overlay {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  background: var(--dshd-brand-dropzone);
  border: 2px dashed var(--dshd-brand-dropborder);
  border-radius: 8px;
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.12s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: inset 0 0 24px rgba(59, 130, 246, 0.35);
}

.dshd-drop-badge {
  background: rgba(15, 23, 42, 0.92);
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid rgba(59, 130, 246, 0.6);
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13.5px;
  font-weight: 500;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

.dshd-drop-badge svg {
  color: #3b82f6;
}

/* 侧边栏右键菜单扩展 (Antigravity 2.0 Split Context Menu) */
.dshd-menu-split-wrap {
  position: relative;
}

.dshd-menu-split-trigger {
  width: 100%;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
}

.dshd-split-submenu {
  display: none;
  position: absolute;
  left: 100%;
  top: 0;
  min-width: 170px;
  padding: 4px;
  border-radius: 8px;
  background: rgba(22, 24, 34, 0.96);
  border: 1px solid var(--dshd-border-default);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(16px);
  z-index: 10000;
  flex-direction: column;
  gap: 2px;
}

@media (prefers-color-scheme: light) {
  .dshd-split-submenu {
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }
}

.dshd-menu-split-wrap:hover .dshd-split-submenu {
  display: flex;
}

.dshd-submenu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: var(--dshd-text-primary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: all 0.12s ease;
  user-select: none;
}

.dshd-submenu-item:hover {
  background-color: var(--dshd-brand-primary);
  color: #ffffff;
}

.dshd-submenu-item svg {
  flex-shrink: 0;
}
`;

    function ensureStylesInjected() {
      if (typeof document === 'undefined') return;
      if (!document.getElementById('dshd-split-view-styles')) {
        const style = document.createElement('style');
        style.id = 'dshd-split-view-styles';
        style.textContent = CSS_STYLES;
        document.head.appendChild(style);
      }
    }

    /* =========================================================================
     * 2. 矢量 SVG 图标
     * ========================================================================= */
    const SVG_ICONS = {
      splitRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M12 4v16 M15 12h5 M18 9l3 3-3 3"/></svg>',
      splitDown: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M4 12h16 M12 15v5 M9 18l3 3 3-3"/></svg>',
      splitMenu: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M12 4v16"/></svg>',
      maximize: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7"/></svg>',
      restore: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6 M20 10h-6V4 M14 10l7-7 M10 14l-7 7"/></svg>',
      close: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      session: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
    };

    /* =========================================================================
     * 3. 核心布局树算法 (Binary Split Tree Engine)
     * ========================================================================= */
    let idCounter = 0;
    function generateUniqueId(prefix = 'pane') {
      idCounter += 1;
      return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}_${idCounter}`;
    }

    function createInitialTree(initialSessionId = null) {
      const paneId = generateUniqueId('pane');
      return {
        tree: {
          kind: 'leaf',
          id: paneId,
          sessionId: initialSessionId
        },
        focusedPaneId: paneId,
        maximizedPaneId: null
      };
    }

    function collectLeafNodes(node, result = []) {
      if (node.kind === 'leaf') {
        result.push(node);
      } else {
        collectLeafNodes(node.first, result);
        collectLeafNodes(node.second, result);
      }
      return result;
    }

    function findNode(node, id) {
      if (node.id === id) return node;
      if (node.kind === 'branch') {
        return findNode(node.first, id) || findNode(node.second, id);
      }
      return null;
    }

    function splitPaneInTree(layout, targetPaneId, direction, newSessionId = null, insertBefore = false) {
      const newPaneId = generateUniqueId('pane');
      const newLeaf = {
        kind: 'leaf',
        id: newPaneId,
        sessionId: newSessionId
      };

      function replace(node) {
        if (node.kind === 'leaf' && node.id === targetPaneId) {
          return {
            kind: 'branch',
            id: generateUniqueId('branch'),
            direction,
            fraction: 0.5,
            first: insertBefore ? newLeaf : node,
            second: insertBefore ? node : newLeaf
          };
        }
        if (node.kind === 'branch') {
          return {
            ...node,
            first: replace(node.first),
            second: replace(node.second)
          };
        }
        return node;
      }

      return {
        ...layout,
        tree: replace(layout.tree),
        focusedPaneId: newPaneId,
        maximizedPaneId: null
      };
    }

    function closePaneInTree(layout, targetPaneId) {
      const leaves = collectLeafNodes(layout.tree);
      if (leaves.length <= 1) {
        return layout;
      }

      function prune(node) {
        if (node.kind === 'leaf') {
          return node.id === targetPaneId ? null : node;
        }
        const nextFirst = prune(node.first);
        const nextSecond = prune(node.second);

        if (nextFirst === null) return nextSecond;
        if (nextSecond === null) return nextFirst;

        return {
          ...node,
          first: nextFirst,
          second: nextSecond
        };
      }

      const updatedTree = prune(layout.tree) || layout.tree;
      const remainingLeaves = collectLeafNodes(updatedTree);
      let nextFocusedId = layout.focusedPaneId;

      if (nextFocusedId === targetPaneId) {
        nextFocusedId = remainingLeaves[0]?.id || '';
      }

      return {
        tree: updatedTree,
        focusedPaneId: nextFocusedId,
        maximizedPaneId: null
      };
    }

    function resizeDividerInTree(root, branchId, delta, totalSize, minSize = MIN_PANE_SIZE) {
      function update(node) {
        if (node.kind === 'leaf') return node;
        if (node.id === branchId) {
          const currentFirstPx = totalSize * node.fraction;
          const targetFirstPx = currentFirstPx + delta;
          const clampedFirstPx = Math.max(minSize, Math.min(totalSize - minSize, targetFirstPx));
          const newFraction = totalSize > 0 ? clampedFirstPx / totalSize : 0.5;
          return {
            ...node,
            fraction: Math.max(0.1, Math.min(0.9, newFraction))
          };
        }
        return {
          ...node,
          first: update(node.first),
          second: update(node.second)
        };
      }
      return update(root);
    }

    function computeLayoutGeometry(layout, containerRect, dividerSize = DEFAULT_DIVIDER_SIZE) {
      const panes = [];
      const dividers = [];

      if (layout.maximizedPaneId) {
        const target = findNode(layout.tree, layout.maximizedPaneId);
        if (target && target.kind === 'leaf') {
          panes.push({
            id: target.id,
            sessionId: target.sessionId,
            rect: { ...containerRect },
            focused: true,
            maximized: true
          });
          return { panes, dividers };
        }
      }

      function layoutRecursive(node, currentRect) {
        if (node.kind === 'leaf') {
          panes.push({
            id: node.id,
            sessionId: node.sessionId,
            rect: { ...currentRect },
            focused: node.id === layout.focusedPaneId,
            maximized: false
          });
          return;
        }

        const { direction, fraction, first, second, id } = node;
        const isHorizontal = direction === 'horizontal';

        if (isHorizontal) {
          const availableWidth = Math.max(0, currentRect.width - dividerSize);
          const firstWidth = Math.round(availableWidth * fraction);
          const secondWidth = Math.max(0, availableWidth - firstWidth);

          const firstRect = {
            x: currentRect.x,
            y: currentRect.y,
            width: firstWidth,
            height: currentRect.height
          };

          const dividerRect = {
            x: currentRect.x + firstWidth,
            y: currentRect.y,
            width: dividerSize,
            height: currentRect.height
          };

          const secondRect = {
            x: currentRect.x + firstWidth + dividerSize,
            y: currentRect.y,
            width: secondWidth,
            height: currentRect.height
          };

          dividers.push({
            id: `divider_${id}`,
            branchId: id,
            direction,
            rect: dividerRect,
            totalSize: currentRect.width - dividerSize
          });

          layoutRecursive(first, firstRect);
          layoutRecursive(second, secondRect);
        } else {
          const availableHeight = Math.max(0, currentRect.height - dividerSize);
          const firstHeight = Math.round(availableHeight * fraction);
          const secondHeight = Math.max(0, availableHeight - firstHeight);

          const firstRect = {
            x: currentRect.x,
            y: currentRect.y,
            width: currentRect.width,
            height: firstHeight
          };

          const dividerRect = {
            x: currentRect.x,
            y: currentRect.y + firstHeight,
            width: currentRect.width,
            height: dividerSize
          };

          const secondRect = {
            x: currentRect.x,
            y: currentRect.y + firstHeight + dividerSize,
            width: currentRect.width,
            height: secondHeight
          };

          dividers.push({
            id: `divider_${id}`,
            branchId: id,
            direction,
            rect: dividerRect,
            totalSize: currentRect.height - dividerSize
          });

          layoutRecursive(first, firstRect);
          layoutRecursive(second, secondRect);
        }
      }

      layoutRecursive(layout.tree, containerRect);
      return { panes, dividers };
    }

    function detectDropZone(paneRect, clientX, clientY, ratio = 0.35) {
      const relX = clientX - paneRect.x;
      const relY = clientY - paneRect.y;

      if (relX < 0 || relX > paneRect.width || relY < 0 || relY > paneRect.height) {
        return { position: 'none', rect: null };
      }

      const thresholdW = paneRect.width * ratio;
      const thresholdH = paneRect.height * ratio;

      const distLeft = relX;
      const distRight = paneRect.width - relX;
      const distTop = relY;
      const distBottom = paneRect.height - relY;

      const minDist = Math.min(distLeft, distRight, distTop, distBottom);

      if (minDist === distLeft && distLeft <= thresholdW) {
        return {
          position: 'left',
          rect: { x: paneRect.x, y: paneRect.y, width: paneRect.width / 2, height: paneRect.height }
        };
      }
      if (minDist === distRight && distRight <= thresholdW) {
        return {
          position: 'right',
          rect: { x: paneRect.x + paneRect.width / 2, y: paneRect.y, width: paneRect.width / 2, height: paneRect.height }
        };
      }
      if (minDist === distTop && distTop <= thresholdH) {
        return {
          position: 'top',
          rect: { x: paneRect.x, y: paneRect.y, width: paneRect.width, height: paneRect.height / 2 }
        };
      }
      if (minDist === distBottom && distBottom <= thresholdH) {
        return {
          position: 'bottom',
          rect: { x: paneRect.x, y: paneRect.y + paneRect.height / 2, width: paneRect.width, height: paneRect.height / 2 }
        };
      }

      return {
        position: 'center',
        rect: { ...paneRect }
      };
    }

    /* =========================================================================
     * 4. 平台检测与辅助
     * ========================================================================= */
    function detectPlatform() {
      if (typeof navigator === 'undefined') return 'macos';
      const p = navigator.platform ? navigator.platform.toLowerCase() : '';
      if (p.includes('mac')) return 'macos';
      if (p.includes('win')) return 'windows';
      return 'macos';
    }

    /* =========================================================================
     * 5. Antigravity 2.0 Split View 核心控制器 (全功能多窗格调度器)
     * ========================================================================= */
    class SplitViewController {
      constructor() {
        this.layout = null;
        this.paneTitles = {}; // paneId -> title
        this.snapshotMap = {}; // paneId -> cloneNode(true)
        this.activeDragSession = null;
        this.lastContextSession = null; // { id, title }
        this.mainEl = null;
        this.containerEl = null;
        this.draggingDivider = null;
        this.resizeObserver = null;
      }

      init() {
        ensureStylesInjected();
        this.restoreLayout();
        this.setupDndListeners();
        this.setupKeyboardListeners();
        this.setupContextMenuObserver();
        this.mountOrUpdateContainer();
      }

      restoreLayout() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const data = JSON.parse(raw);
            if (data && data.tree && data.focusedPaneId) {
              this.layout = data;
              return;
            }
          }
        } catch (e) {
          console.warn('[dshd-split-view] Restore layout failed:', e);
        }

        const currentSession = this.detectCurrentSession();
        this.layout = createInitialTree(currentSession.id);
        if (currentSession.id) {
          this.paneTitles[this.layout.focusedPaneId] = currentSession.title;
        }
      }

      saveLayout() {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.layout));
        } catch (e) {
          console.warn('[dshd-split-view] Save layout failed:', e);
        }
      }

      detectCurrentSession() {
        let id = null;
        let title = '当前会话';

        try {
          const stored = localStorage.getItem('dsh.sessions.current');
          if (stored) {
            const parsed = JSON.parse(stored);
            id = parsed.sessionId || null;
          }
        } catch (_) {}

        if (typeof document !== 'undefined') {
          if (document.title) {
            title = document.title.replace('— DeepSeek Harness', '').trim();
          }
          if (!id) {
            const activeRow = document.querySelector('[data-dsh-claude-part="session-row"][aria-selected="true"]');
            if (activeRow) {
              id = activeRow.getAttribute('data-row-key')?.replace('session:', '') || null;
              title = activeRow.innerText.trim().split('\n')[0] || title;
            }
          }
        }

        return { id, title };
      }

      getSessionInfo(sessionId) {
        if (!sessionId) return { id: null, title: '新会话' };
        if (typeof document !== 'undefined') {
          const row = document.querySelector(`[data-row-key="session:${sessionId}"]`);
          if (row) {
            const title = row.innerText.trim().split('\n')[0] || '会话';
            return { id: sessionId, title };
          }
        }
        return { id: sessionId, title: `会话 (${sessionId.slice(0, 8)})` };
      }

      openSession(sessionId) {
        if (!sessionId || typeof document === 'undefined') return;
        const row = document.querySelector(`[data-row-key="session:${sessionId}"]`);
        if (row) {
          row.click();
        }
      }

      /* =======================================================================
       * 6. 侧边栏会话右键菜单扩展 (Antigravity 2.0 Split Context Menu)
       * ======================================================================= */
      setupContextMenuObserver() {
        if (typeof document === 'undefined') return;

        // 监听侧边栏的右键与点击操作，记住当前目标会话
        document.addEventListener('contextmenu', (e) => {
          const target = e.target;
          if (!target || !target.closest) return;
          const row = target.closest('[data-row-key^="session:"], [data-dsh-claude-part="session-row"]');
          if (row) {
            const rowKey = row.getAttribute('data-row-key');
            const sessionId = rowKey ? rowKey.replace('session:', '') : null;
            const title = row.innerText.trim().split('\n')[0] || '会话';
            this.lastContextSession = { id: sessionId, title };
          }
        }, true);

        document.addEventListener('mousedown', (e) => {
          const target = e.target;
          if (!target || !target.closest) return;
          const btn = target.closest('.jJkEga_iconButton, [aria-label*="会话"]');
          if (btn) {
            const row = btn.closest('[data-row-key^="session:"], [data-dsh-claude-part="session-row"]');
            if (row) {
              const rowKey = row.getAttribute('data-row-key');
              const sessionId = rowKey ? rowKey.replace('session:', '') : null;
              const title = row.innerText.trim().split('\n')[0] || '会话';
              this.lastContextSession = { id: sessionId, title };
            }
          }
        }, true);

        // 使用 MutationObserver 捕获弹出的 menu，动态插入「分屏 (Split) >」子菜单
        const observer = new MutationObserver(() => {
          const menus = document.querySelectorAll('[role="menu"]');
          menus.forEach(menu => {
            if (menu.querySelector('.dshd-menu-split-wrap')) return;

            // 确认是会话操作菜单 (含有重命名或归档或复制)
            const text = menu.innerText || '';
            const isSessionMenu = text.includes('重命名') || text.includes('分叉会话') || text.includes('归档') || text.includes('Rename');
            if (!isSessionMenu) return;

            // 查找插入锚点 (通常在分叉会话或重命名之后)
            const items = Array.from(menu.querySelectorAll('button[role="menuitem"], ._itemWrap_4ub78_90'));
            const anchor = items[items.length - 2] || items[items.length - 1];
            if (!anchor) return;

            const splitMenuItem = document.createElement('div');
            splitMenuItem.className = '_itemWrap_4ub78_90 dshd-menu-split-wrap';
            splitMenuItem.innerHTML = `
              <button type="button" role="menuitem" class="_item_4ub78_90 dshd-menu-split-trigger">
                <span class="_itemIcon_4ub78_148">${SVG_ICONS.splitMenu}</span>
                <span style="flex: 1; text-align: left; margin-left: 8px;">分屏 (Split)</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
              <div class="dshd-split-submenu">
                <button type="button" class="dshd-submenu-item" data-dshd-action="split-right">
                  ${SVG_ICONS.splitRight}
                  <span>向右分屏 (Split Right)</span>
                </button>
                <button type="button" class="dshd-submenu-item" data-dshd-action="split-down">
                  ${SVG_ICONS.splitDown}
                  <span>向下分屏 (Split Down)</span>
                </button>
              </div>
            `;

            // 绑定子菜单动作
            const rightBtn = splitMenuItem.querySelector('[data-dshd-action="split-right"]');
            const downBtn = splitMenuItem.querySelector('[data-dshd-action="split-down"]');

            const closeMenu = () => {
              document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            };

            rightBtn.onclick = (e) => {
              e.stopPropagation();
              closeMenu();
              const target = this.lastContextSession || this.detectCurrentSession();
              this.splitPane(this.layout.focusedPaneId, 'horizontal', target.id, target.title);
            };

            downBtn.onclick = (e) => {
              e.stopPropagation();
              closeMenu();
              const target = this.lastContextSession || this.detectCurrentSession();
              this.splitPane(this.layout.focusedPaneId, 'vertical', target.id, target.title);
            };

            const parent = anchor.parentElement;
            if (parent) {
              parent.insertBefore(splitMenuItem, anchor.nextSibling);
            }
          });
        });

        observer.observe(document.body, { childList: true, subtree: true });
      }

      /* =======================================================================
       * 7. 拖拽与热区检测 (Antigravity 2.0 Multi-Pane Dropzone)
       * ======================================================================= */
      setupDndListeners() {
        if (typeof window === 'undefined') return;

        window.addEventListener('dragstart', (e) => {
          const target = e.target;
          if (!target || !target.closest) return;

          const row = target.closest('[data-row-key^="session:"], [data-dsh-claude-part="session-row"]');
          if (row) {
            const rowKey = row.getAttribute('data-row-key');
            const sessionId = rowKey ? rowKey.replace('session:', '') : null;
            const title = row.innerText.trim().split('\n')[0] || '会话';

            if (sessionId) {
              this.activeDragSession = { id: sessionId, title };
              e.dataTransfer.effectAllowed = 'all';
              e.dataTransfer.setData('text/plain', sessionId);
              e.dataTransfer.setData('application/dsh-session', JSON.stringify(this.activeDragSession));
            }
          }
        }, true);

        window.addEventListener('dragover', (e) => {
          const container = document.getElementById('dshd-split-container');
          const centerCol = document.querySelector('[data-dsh-claude-part="center-column"]');
          const targetArea = container || centerCol;
          if (!targetArea) return;

          const centerRect = targetArea.getBoundingClientRect();
          const inArea = (
            e.clientX >= centerRect.left &&
            e.clientX <= centerRect.right &&
            e.clientY >= centerRect.top &&
            e.clientY <= centerRect.bottom
          );

          if (inArea) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';

            // 查找鼠标当前悬停在哪一个具体的 Pane 之上
            const paneEls = targetArea.querySelectorAll('.dshd-pane');
            let hoveredPaneEl = null;
            let hoveredRect = null;

            for (const el of paneEls) {
              const r = el.getBoundingClientRect();
              if (
                e.clientX >= r.left &&
                e.clientX <= r.right &&
                e.clientY >= r.top &&
                e.clientY <= r.bottom
              ) {
                hoveredPaneEl = el;
                hoveredRect = r;
                break;
              }
            }

            if (!hoveredPaneEl) {
              hoveredRect = centerRect;
            }

            const paneRectObj = {
              x: hoveredRect.left,
              y: hoveredRect.top,
              width: hoveredRect.width,
              height: hoveredRect.height
            };

            const zone = detectDropZone(paneRectObj, e.clientX, e.clientY, 0.35);
            this.showDropOverlay(zone.rect, zone.position);
          } else {
            this.hideDropOverlay();
          }
        }, true);

        window.addEventListener('dragleave', (e) => {
          if (!e.relatedTarget) {
            this.hideDropOverlay();
          }
        }, true);

        window.addEventListener('dragend', () => {
          this.hideDropOverlay();
          this.activeDragSession = null;
        }, true);

        window.addEventListener('drop', (e) => {
          const container = document.getElementById('dshd-split-container');
          const centerCol = document.querySelector('[data-dsh-claude-part="center-column"]');
          const targetArea = container || centerCol;
          if (!targetArea) return;

          const centerRect = targetArea.getBoundingClientRect();
          const inArea = (
            e.clientX >= centerRect.left &&
            e.clientX <= centerRect.right &&
            e.clientY >= centerRect.top &&
            e.clientY <= centerRect.bottom
          );

          if (inArea) {
            e.preventDefault();
            this.hideDropOverlay();

            let sessionId = this.activeDragSession?.id;
            let title = this.activeDragSession?.title;

            if (!sessionId) {
              const dtText = e.dataTransfer.getData('text/plain');
              if (dtText && dtText.startsWith('session-')) {
                sessionId = dtText;
                const info = this.getSessionInfo(sessionId);
                title = info.title;
              }
            }

            if (sessionId) {
              // 找到目标 pane
              const paneEls = targetArea.querySelectorAll('.dshd-pane');
              let targetPaneId = this.layout.focusedPaneId;
              let hoveredRect = centerRect;

              for (const el of paneEls) {
                const r = el.getBoundingClientRect();
                if (
                  e.clientX >= r.left &&
                  e.clientX <= r.right &&
                  e.clientY >= r.top &&
                  e.clientY <= r.bottom
                ) {
                  targetPaneId = el.getAttribute('data-pane-id');
                  hoveredRect = r;
                  break;
                }
              }

              const paneRectObj = {
                x: hoveredRect.left,
                y: hoveredRect.top,
                width: hoveredRect.width,
                height: hoveredRect.height
              };

              const zone = detectDropZone(paneRectObj, e.clientX, e.clientY, 0.35);
              this.handleDropAction(targetPaneId, zone.position, sessionId, title);
            }

            this.activeDragSession = null;
          }
        }, true);
      }

      showDropOverlay(rect, position) {
        if (!rect) {
          this.hideDropOverlay();
          return;
        }

        let overlay = document.getElementById('dshd-drop-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'dshd-drop-overlay';
          document.body.appendChild(overlay);
        }

        overlay.style.left = `${rect.x}px`;
        overlay.style.top = `${rect.y}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;

        let label = '向右拆分窗格 (Split Right)';
        let icon = SVG_ICONS.splitRight;

        if (position === 'left') {
          label = '向左拆分窗格 (Split Left)';
          icon = SVG_ICONS.splitRight;
        } else if (position === 'bottom') {
          label = '向下拆分窗格 (Split Down)';
          icon = SVG_ICONS.splitDown;
        } else if (position === 'top') {
          label = '向上拆分窗格 (Split Top)';
          icon = SVG_ICONS.splitDown;
        } else if (position === 'center') {
          label = '在当前窗格打开 (Open in Pane)';
          icon = SVG_ICONS.session;
        }

        overlay.innerHTML = `
          <div class="dshd-drop-badge">
            ${icon}
            <span>${label}</span>
          </div>
        `;
      }

      hideDropOverlay() {
        const overlay = document.getElementById('dshd-drop-overlay');
        if (overlay) {
          overlay.remove();
        }
      }

      handleDropAction(targetPaneId, position, sessionId, title) {
        if (position === 'right' || position === 'left') {
          this.splitPane(targetPaneId, 'horizontal', sessionId, title, position === 'left');
        } else if (position === 'bottom' || position === 'top') {
          this.splitPane(targetPaneId, 'vertical', sessionId, title, position === 'top');
        } else {
          this.switchPaneSession(targetPaneId, sessionId, title);
        }
      }

      /* =======================================================================
       * 8. 窗格拆分、关闭与会话调度
       * ======================================================================= */
      splitPane(targetPaneId, dir = 'horizontal', newSessionId = null, newTitle = null, insertBefore = false) {
        const targetId = targetPaneId || this.layout.focusedPaneId;
        const info = newSessionId ? { id: newSessionId, title: newTitle || '会话' } : this.detectCurrentSession();

        this.snapshotActivePane();

        this.layout = splitPaneInTree(this.layout, targetId, dir, info.id, insertBefore);
        if (info.id) {
          this.paneTitles[this.layout.focusedPaneId] = info.title || '新窗格';
        }

        this.saveLayout();
        this.mountOrUpdateContainer();

        if (info.id) {
          this.openSession(info.id);
        }
      }

      closePane(paneId) {
        const leaves = collectLeafNodes(this.layout.tree);
        if (leaves.length <= 1) return;

        this.snapshotActivePane();
        this.layout = closePaneInTree(this.layout, paneId);
        delete this.paneTitles[paneId];
        delete this.snapshotMap[paneId];

        this.saveLayout();
        this.mountOrUpdateContainer();

        const activeLeaf = findNode(this.layout.tree, this.layout.focusedPaneId);
        if (activeLeaf && activeLeaf.sessionId) {
          this.openSession(activeLeaf.sessionId);
        }
      }

      toggleMaximize(paneId) {
        const targetId = paneId || this.layout.focusedPaneId;
        if (this.layout.maximizedPaneId === targetId) {
          this.layout.maximizedPaneId = null;
        } else {
          this.layout.maximizedPaneId = targetId;
        }
        this.saveLayout();
        this.mountOrUpdateContainer();
      }

      focusPane(paneId) {
        if (this.layout.focusedPaneId === paneId) return;

        this.snapshotActivePane();
        this.layout.focusedPaneId = paneId;
        this.saveLayout();
        this.mountOrUpdateContainer();

        const leaf = findNode(this.layout.tree, paneId);
        if (leaf && leaf.sessionId) {
          this.openSession(leaf.sessionId);
        }
      }

      switchPaneSession(paneId, sessionId, title) {
        const leaf = findNode(this.layout.tree, paneId);
        if (leaf) {
          leaf.sessionId = sessionId;
          this.paneTitles[paneId] = title || this.paneTitles[paneId] || '会话';
          this.layout.focusedPaneId = paneId;
          this.saveLayout();
          this.mountOrUpdateContainer();
          this.openSession(sessionId);
        }
      }

      snapshotActivePane() {
        const currentPaneId = this.layout.focusedPaneId;
        if (!currentPaneId) return;

        const main = this.mainEl || document.querySelector('[data-slot="main"]');
        if (main) {
          const root = main.querySelector('.ST7X_W_root');
          if (root) {
            this.snapshotMap[currentPaneId] = root.cloneNode(true);
          }
        }
      }

      /* =======================================================================
       * 9. 快捷键
       * ======================================================================= */
      setupKeyboardListeners() {
        if (typeof window === 'undefined') return;

        window.addEventListener('keydown', (e) => {
          const isMac = detectPlatform() === 'macos';
          const modifier = isMac ? e.metaKey : e.ctrlKey;
          if (!modifier || !e.altKey) return;

          const currentId = this.layout.focusedPaneId;

          if (e.code === 'KeyD') {
            e.preventDefault();
            this.splitPane(currentId, 'horizontal');
          } else if (e.code === 'KeyV') {
            e.preventDefault();
            this.splitPane(currentId, 'vertical');
          } else if (e.code === 'KeyW') {
            e.preventDefault();
            this.closePane(currentId);
          } else if (e.code === 'Enter') {
            e.preventDefault();
            this.toggleMaximize(currentId);
          }
        });
      }

      /* =======================================================================
       * 10. DOM 挂载与全树动态几何排版渲染 (任意 N-Pane 绝对定位布局)
       * ======================================================================= */
      mountOrUpdateContainer() {
        if (typeof document === 'undefined') return;

        const centerCol = document.querySelector('[data-dsh-claude-part="center-column"]');
        if (!centerCol) {
          setTimeout(() => this.mountOrUpdateContainer(), 200);
          return;
        }

        let main = this.mainEl || centerCol.querySelector('[data-slot="main"]') || document.querySelector('[data-slot="main"]');
        if (!main) {
          setTimeout(() => this.mountOrUpdateContainer(), 200);
          return;
        }
        this.mainEl = main;

        let container = document.getElementById('dshd-split-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'dshd-split-container';
          centerCol.insertBefore(container, centerCol.firstChild);

          // 开启容器尺寸变动监听，自适应窗口缩放
          this.resizeObserver = new ResizeObserver(() => {
            this.renderLayoutGeometry();
          });
          this.resizeObserver.observe(container);
        }
        this.containerEl = container;

        this.renderLayoutGeometry();
      }

      renderLayoutGeometry() {
        if (!this.containerEl || !this.mainEl) return;

        const container = this.containerEl;
        const main = this.mainEl;
        const centerCol = container.parentElement;

        // **保护 main 绝不被 innerHTML 清空销毁**
        if (main.parentElement && main.parentElement !== centerCol) {
          centerCol.appendChild(main);
        }

        const rect = container.getBoundingClientRect();
        const containerRect = {
          x: 0,
          y: 0,
          width: rect.width || centerCol.clientWidth || 800,
          height: rect.height || centerCol.clientHeight || 600
        };

        const geometry = computeLayoutGeometry(this.layout, containerRect, DEFAULT_DIVIDER_SIZE);

        container.innerHTML = '';

        const leaves = collectLeafNodes(this.layout.tree);
        const totalPanesCount = leaves.length;

        // 渲染所有窗格
        geometry.panes.forEach(paneGeo => {
          const isFocused = paneGeo.id === this.layout.focusedPaneId;

          const paneEl = document.createElement('div');
          paneEl.className = `dshd-pane ${isFocused ? 'dshd-pane-focused' : ''}`;
          paneEl.setAttribute('data-pane-id', paneGeo.id);
          paneEl.style.left = `${paneGeo.rect.x}px`;
          paneEl.style.top = `${paneGeo.rect.y}px`;
          paneEl.style.width = `${paneGeo.rect.width}px`;
          paneEl.style.height = `${paneGeo.rect.height}px`;

          // Header
          const headerEl = document.createElement('div');
          headerEl.className = 'dshd-pane-header';

          const title = this.paneTitles[paneGeo.id] || (paneGeo.sessionId ? this.getSessionInfo(paneGeo.sessionId).title : '主会话');

          const tabEl = document.createElement('div');
          tabEl.className = 'dshd-pane-tab';
          tabEl.innerHTML = `
            <span class="dshd-focus-dot"></span>
            ${SVG_ICONS.session}
            <span class="dshd-pane-title" title="${title}">${title}</span>
          `;
          tabEl.onclick = () => this.focusPane(paneGeo.id);

          const actionsEl = document.createElement('div');
          actionsEl.className = 'dshd-pane-actions';

          // Split Right
          const splitRightBtn = document.createElement('button');
          splitRightBtn.className = 'dshd-icon-btn';
          splitRightBtn.title = '向右拆分 (⌘⌥D / Ctrl+Alt+D)';
          splitRightBtn.innerHTML = SVG_ICONS.splitRight;
          splitRightBtn.onclick = (e) => {
            e.stopPropagation();
            this.splitPane(paneGeo.id, 'horizontal');
          };

          // Split Down
          const splitDownBtn = document.createElement('button');
          splitDownBtn.className = 'dshd-icon-btn';
          splitDownBtn.title = '向下拆分 (⌘⌥V / Ctrl+Alt+V)';
          splitDownBtn.innerHTML = SVG_ICONS.splitDown;
          splitDownBtn.onclick = (e) => {
            e.stopPropagation();
            this.splitPane(paneGeo.id, 'vertical');
          };

          // Maximize
          const maxBtn = document.createElement('button');
          maxBtn.className = 'dshd-icon-btn';
          maxBtn.title = this.layout.maximizedPaneId === paneGeo.id ? '还原窗格 (⌘⌥↵)' : '最大化窗格 (⌘⌥↵)';
          maxBtn.innerHTML = this.layout.maximizedPaneId === paneGeo.id ? SVG_ICONS.restore : SVG_ICONS.maximize;
          maxBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleMaximize(paneGeo.id);
          };

          actionsEl.appendChild(splitRightBtn);
          actionsEl.appendChild(splitDownBtn);
          actionsEl.appendChild(maxBtn);

          // 动作分割线
          const sep = document.createElement('span');
          sep.className = 'dshd-action-divider';
          actionsEl.appendChild(sep);

          // 右上角专属关闭 X 按钮
          const closeBtn = document.createElement('button');
          closeBtn.className = 'dshd-icon-btn dshd-pane-close-btn';
          closeBtn.title = totalPanesCount > 1 ? '关闭窗格 (⌘⌥W / Ctrl+Alt+W)' : '当前为唯一窗格';
          closeBtn.innerHTML = SVG_ICONS.close;
          closeBtn.onclick = (e) => {
            e.stopPropagation();
            if (totalPanesCount > 1) {
              this.closePane(paneGeo.id);
            } else {
              console.info('[dshd-split-view] 当前已是唯一窗格');
            }
          };
          actionsEl.appendChild(closeBtn);

          headerEl.appendChild(tabEl);
          headerEl.appendChild(actionsEl);

          // Body
          const bodyEl = document.createElement('div');
          bodyEl.className = 'dshd-pane-body';

          if (isFocused) {
            bodyEl.appendChild(main);
          } else {
            if (this.snapshotMap[paneGeo.id]) {
              bodyEl.appendChild(this.snapshotMap[paneGeo.id].cloneNode(true));
            } else {
              const placeholder = document.createElement('div');
              placeholder.className = 'dshd-pane-placeholder';
              placeholder.innerHTML = `
                <div class="dshd-placeholder-card">
                  <div class="dshd-placeholder-icon">${SVG_ICONS.session}</div>
                  <div class="dshd-placeholder-title" title="${title}">${title}</div>
                  <div class="dshd-placeholder-hint">点击激活并切换会话</div>
                </div>
              `;
              bodyEl.appendChild(placeholder);
            }

            const clickCapture = document.createElement('div');
            clickCapture.className = 'dshd-pane-click-capture';
            clickCapture.onclick = () => this.focusPane(paneGeo.id);
            bodyEl.appendChild(clickCapture);
          }

          paneEl.appendChild(headerEl);
          paneEl.appendChild(bodyEl);
          container.appendChild(paneEl);
        });

        // 渲染所有分割条
        geometry.dividers.forEach(divGeo => {
          const isH = divGeo.direction === 'horizontal';
          const divEl = document.createElement('div');
          divEl.className = `dshd-split-divider ${isH ? 'dshd-divider-h' : 'dshd-divider-v'}`;
          divEl.style.left = `${divGeo.rect.x}px`;
          divEl.style.top = `${divGeo.rect.y}px`;
          divEl.style.width = `${divGeo.rect.width}px`;
          divEl.style.height = `${divGeo.rect.height}px`;

          divEl.onmousedown = (e) => {
            e.preventDefault();
            this.startDividerDrag(e, divGeo.branchId, divGeo.direction, divGeo.totalSize);
          };

          container.appendChild(divEl);
        });
      }

      startDividerDrag(e, branchId, direction, totalSize) {
        this.draggingDivider = {
          branchId,
          direction,
          totalSize,
          startPos: direction === 'horizontal' ? e.clientX : e.clientY
        };

        const onMouseMove = (moveEvent) => {
          if (!this.draggingDivider) return;
          const currentPos = this.draggingDivider.direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
          const delta = currentPos - this.draggingDivider.startPos;

          this.layout.tree = resizeDividerInTree(
            this.layout.tree,
            this.draggingDivider.branchId,
            delta,
            this.draggingDivider.totalSize
          );

          this.renderLayoutGeometry();
        };

        const onMouseUp = () => {
          this.draggingDivider = null;
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          this.saveLayout();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      }
    }

    /* =========================================================================
     * 11. Cordis 客户端插件入口与导出
     * ========================================================================= */
    const inject = ['slots', 'sessions', 'theme', 'locale'];

    function apply(ctx) {
      ensureStylesInjected();
      console.info('[dshd-split-view] Antigravity 2.0 Native Multi-Pane Split Engine initialized on DeepSeek Harness Desktop.');

      if (typeof window !== 'undefined') {
        const controller = new SplitViewController();
        window.__DSHD_CONTROLLER__ = controller;
        controller.init();
      }
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.SplitViewController = SplitViewController;

    return module.exports;
  }

  // 1. ModuleLoader 方式注册 (DSH Desktop 标准)
  if (typeof window !== 'undefined' && window.__ModuleLoader__ && window.__ModuleLoader__.load) {
    window.__ModuleLoader__.load({
      id: 'dshd-split-view',
      factory: factory
    });
  }

  // 2. CommonJS / ESM 兼容支持
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(typeof require !== 'undefined' ? require : null);
  }
})();
