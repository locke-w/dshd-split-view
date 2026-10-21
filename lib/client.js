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
  transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.dshd-pane-close-btn:hover {
  background-color: rgba(239, 68, 68, 0.16) !important;
  color: #ef4444 !important;
  transform: scale(1.12) !important;
}

.dshd-pane-close-btn:active {
  transform: scale(0.92) !important;
}

/* 窗格主体内容区域 */
.dshd-pane-body {
  flex: 1 1 auto;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: calc(100% - 38px);
}

/* 独立会话 iframe */
.dshd-pane-frame {
  width: 100%;
  height: 100%;
  border: none;
  background-color: var(--dshd-bg-pane);
  display: block;
}

/* 拖拽分割条时的全局防干扰遮罩 */
.dshd-is-dragging .dshd-pane-frame {
  pointer-events: none !important;
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
#dshd-drop-overlay,
.dshd-drop-overlay {
  position: absolute;
  z-index: 99999;
  pointer-events: none;
  background: var(--dshd-brand-dropzone, rgba(59, 130, 246, 0.18));
  border: 2px dashed var(--dshd-brand-dropborder, #3b82f6);
  border-radius: 8px;
  backdrop-filter: blur(2px);
  display: none;
  align-items: center;
  justify-content: center;
  transition: all 0.12s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: inset 0 0 24px rgba(59, 130, 246, 0.35);
  box-sizing: border-box;
}

.dshd-drop-card,
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
  pointer-events: none;
}

.dshd-drop-card svg,
.dshd-drop-badge svg {
  color: #3b82f6;
  width: 16px;
  height: 16px;
  display: block;
}

.dshd-drop-title {
  font-weight: 600;
  color: #ffffff;
}

.dshd-drop-hint {
  font-size: 12px;
  color: #94a3b8;
  margin-left: 4px;
}

/* 侧边栏菜单分屏项 (Antigravity 2.0 Split Context Menu Direct Items) */
.dshd-menu-split-item {
  position: relative;
  width: 100%;
}

.dshd-menu-split-btn {
  display: flex !important;
  align-items: center !important;
  width: 100% !important;
  padding: 6px 10px !important;
  background: transparent !important;
  border: none !important;
  color: var(--dshd-text-primary, #e2e8f0) !important;
  font-size: 13px !important;
  cursor: pointer !important;
  border-radius: 4px !important;
  text-align: left !important;
  user-select: none !important;
  transition: background-color 0.12s ease !important;
}

.dshd-menu-split-btn:hover {
  background-color: var(--dshd-brand-primary, #3b82f6) !important;
  color: #ffffff !important;
}

.dshd-menu-split-btn svg {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
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
        this.paneElements = new Map(); // paneId -> HTMLElement
        this.paneFrames = new Map(); // paneId -> HTMLIFrameElement
        this.baseHtml = null;
        this.activeDragSession = null;
        this.lastContextSession = null; // { id, title }
        this.mainEl = null;
        this.containerEl = null;
        this.draggingDivider = null;
        this.resizeObserver = null;
      }

      async init() {
        ensureStylesInjected();
        await this.initBaseHtml();
        this.restoreLayout();
        this.setupDndListeners();
        this.setupKeyboardListeners();
        this.setupContextMenuObserver();
        this.setupSidebarClickListener();
        this.mountOrUpdateContainer();
      }

      async initBaseHtml() {
        if (this.baseHtml) return this.baseHtml;
        try {
          const res = await fetch('dsh-app://app/');
          this.baseHtml = await res.text();
        } catch (e) {
          console.warn('[dshd-split-view] initBaseHtml failed:', e);
        }
        return this.baseHtml;
      }

      generatePaneSrcDoc(paneId, sessionId) {
        if (!this.baseHtml) return '';
        const targetSession = sessionId || '';
        const bridgeScript = `
          <base href="dsh-app://app/">
          <script>
            window.__IS_DSHD_PANE__ = true;
            window.__DSHD_PANE_ID__ = "${paneId}";
            window.__DSHD_SEED_SESSION__ = "${targetSession}";
            
            const p = window.parent;
            window.dshDesktopBoot = p.dshDesktopBoot;
            window.__ModuleLoader__ = p.__ModuleLoader__;
            window.__DSH_TRANSPORT__ = p.__DSH_TRANSPORT__;
            window.dshPlatform = p.dshPlatform;
            window.dshDesktop = p.dshDesktop;
            window.__DSH_LOCALE__ = p.__DSH_LOCALE__;
            window.__DSH_CONTACT_CONFIG__ = p.__DSH_CONTACT_CONFIG__;
            window.__DSH_SHORTCUTS_CONFIG__ = p.__DSH_SHORTCUTS_CONFIG__;
            window.__DSH_DOCUMENT_PREVIEW_CONFIG__ = p.__DSH_DOCUMENT_PREVIEW_CONFIG__;
            window.__DSH_MODELS_ONBOARDING__ = p.__DSH_MODELS_ONBOARDING__;
            window.__DSH_REMOTE_ACCESS__ = p.__DSH_REMOTE_ACCESS__;
            window.__DSH_CONNECTION_RECOVERY__ = p.__DSH_CONNECTION_RECOVERY__;
            window.__DSH_HOST_PATHS__ = p.__DSH_HOST_PATHS__;
            window.__DSH_DIRECTORY_PICKER__ = p.__DSH_DIRECTORY_PICKER__;
            
            globalThis.__DSH_BOOT_READY__ = {
              promise: Promise.resolve(),
              resolve: () => {},
              reject: () => {}
            };
            
            // Auto-activate the target session once DOM / sidebar is ready
            (function() {
              let activated = false;
              function tryActivate() {
                if (activated) return;
                const target = window.__DSHD_SEED_SESSION__;
                if (!target) {
                  activated = true;
                  return;
                }
                const row = document.querySelector('[data-row-key="session:' + target + '"]');
                if (row) {
                  row.click();
                  activated = true;
                  return;
                }
                const toggle = document.querySelector('button._3WPZCG_toggle, button[aria-label*="侧边栏"]');
                if (toggle) {
                  toggle.click();
                  setTimeout(() => {
                    const r = document.querySelector('[data-row-key="session:' + target + '"]');
                    if (r) {
                      r.click();
                      activated = true;
                    }
                  }, 300);
                }
              }
              
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', tryActivate);
              } else {
                tryActivate();
              }
              const timer = setInterval(() => {
                if (activated) clearInterval(timer);
                else tryActivate();
              }, 250);
              setTimeout(() => clearInterval(timer), 8000);

              window.addEventListener('mousedown', () => {
                try {
                  window.parent.__DSHD_CONTROLLER__?.focusPane("${paneId}");
                } catch (focusErr) {
                  console.debug('[dshd-split-view] pane mousedown focus error:', focusErr);
                }
              }, true);
              window.addEventListener('focus', () => {
                try {
                  window.parent.__DSHD_CONTROLLER__?.focusPane("${paneId}");
                } catch (focusErr) {
                  console.debug('[dshd-split-view] pane focus error:', focusErr);
                }
              }, true);
            })();
          </script>
          <style>
            /* Visually hide child sidebar and header, keeping DOM functional */
            [data-slot="sidebar"] {
              opacity: 0 !important;
              pointer-events: none !important;
              position: absolute !important;
              left: -9999px !important;
              width: 0 !important;
              height: 0 !important;
              overflow: hidden !important;
            }
            [data-slot="header"] { display: none !important; }
            ._6Qf49G_frame, [data-slot="root"] {
              grid-template-columns: 0px 1fr 0px !important;
              width: 100% !important;
              height: 100% !important;
            }
            .ST7X_W_centerCol, [data-slot="main"], [data-slot="main.conversation"], .ST7X_W_root {
              width: 100% !important;
              height: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            #dshd-split-container { display: none !important; }
          </style>
        `;
        return this.baseHtml.replace('<head>', '<head>' + bridgeScript);
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
        } catch (err) {
          console.debug('[dshd-split-view] detectCurrentSession error ignored:', err);
        }

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

      setupSidebarClickListener() {
        if (typeof document === 'undefined') return;
        document.addEventListener('click', (e) => {
          const row = e.target?.closest?.('[data-row-key^="session:"]');
          if (row) {
            const rowKey = row.getAttribute('data-row-key');
            const sessionId = rowKey ? rowKey.replace('session:', '') : null;
            const title = row.innerText.trim().split('\n')[0] || '会话';
            const leaves = collectLeafNodes(this.layout.tree);
            if (leaves.length > 1 && sessionId) {
              // 多窗格模式下：点击左侧会话栏，切换当前聚焦窗格的会话，绝不影响其它窗格和侧边栏自身
              this.switchPaneSession(this.layout.focusedPaneId, sessionId, title);
            }
          }
        }, true);
      }

      /* =======================================================================
       * 6. 侧边栏会话右键菜单扩展 (Antigravity 2.0 Split Context Menu)
       * ======================================================================= */
      setupContextMenuObserver() {
        if (typeof document === 'undefined') return;

        // 监听侧边栏的右键与点击操作，记住当前目标会话
        const updateContextSession = (target) => {
          if (!target || !target.closest) return;
          const row = target.closest('[data-row-key^="session:"], [data-dsh-claude-part="session-row"]');
          if (row) {
            const rowKey = row.getAttribute('data-row-key');
            const sessionId = rowKey ? rowKey.replace('session:', '') : null;
            const title = row.innerText.trim().split('\n')[0] || '会话';
            this.lastContextSession = { id: sessionId, title };
          }
        };

        document.addEventListener('contextmenu', (e) => updateContextSession(e.target), true);
        document.addEventListener('pointerdown', (e) => updateContextSession(e.target), true);
        document.addEventListener('mousedown', (e) => updateContextSession(e.target), true);
        document.addEventListener('click', (e) => updateContextSession(e.target), true);

        // 使用 MutationObserver 捕获弹出的 menu，动态插入「向右分屏」和「向下分屏」直出菜单项
        const observer = new MutationObserver(() => {
          const menus = document.querySelectorAll('[role="menu"]');
          menus.forEach(menu => {
            if (menu.querySelector('.dshd-menu-split-item')) return;

            // 确认是会话操作菜单 (含有重命名或分叉会话或归档或删除工作区/删除会话)
            const text = menu.innerText || '';
            const isSessionMenu = text.includes('重命名') || text.includes('分叉会话') || text.includes('归档') || text.includes('Rename') || text.includes('删除工作区') || text.includes('删除会话');
            if (!isSessionMenu) return;

            const viewport = menu.querySelector('._viewport_4ub78_19') || menu;
            const items = Array.from(viewport.querySelectorAll('button[role="menuitem"], ._itemWrap_4ub78_90'));
            if (items.length === 0) return;

            // 寻找危险操作（如“删除”）作为后置锚点，将分屏项插入在其上方
            let anchor = null;
            for (const item of items) {
              if (item.classList.contains('_danger_4ub78_226') || item.querySelector('._danger_4ub78_226') || item.innerText.includes('删除')) {
                anchor = item.closest('._itemWrap_4ub78_90') || item;
                break;
              }
            }
            if (!anchor) {
              anchor = items[items.length - 1].closest('._itemWrap_4ub78_90') || items[items.length - 1];
            }

            const splitRightItem = document.createElement('div');
            splitRightItem.className = '_itemWrap_4ub78_90 dshd-menu-split-item';
            splitRightItem.innerHTML = `
              <button type="button" role="menuitem" class="_item_4ub78_90 dshd-menu-split-btn" data-dshd-action="split-right">
                <span class="_itemIcon_4ub78_148">${SVG_ICONS.splitRight}</span>
                <span class="_itemLabel_4ub78_190" style="flex: 1; text-align: left; margin-left: 8px;">向右分屏</span>
              </button>
            `;

            const splitDownItem = document.createElement('div');
            splitDownItem.className = '_itemWrap_4ub78_90 dshd-menu-split-item';
            splitDownItem.innerHTML = `
              <button type="button" role="menuitem" class="_item_4ub78_90 dshd-menu-split-btn" data-dshd-action="split-down">
                <span class="_itemIcon_4ub78_148">${SVG_ICONS.splitDown}</span>
                <span class="_itemLabel_4ub78_190" style="flex: 1; text-align: left; margin-left: 8px;">向下分屏</span>
              </button>
            `;

            const closeMenu = () => {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
              document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            };

            const rightBtn = splitRightItem.querySelector('button');
            rightBtn.onclick = (e) => {
              e.stopPropagation();
              e.preventDefault();
              closeMenu();
              const target = this.lastContextSession || this.detectCurrentSession();
              this.splitPane(this.layout.focusedPaneId, 'horizontal', target.id, target.title);
            };

            const downBtn = splitDownItem.querySelector('button');
            downBtn.onclick = (e) => {
              e.stopPropagation();
              e.preventDefault();
              closeMenu();
              const target = this.lastContextSession || this.detectCurrentSession();
              this.splitPane(this.layout.focusedPaneId, 'vertical', target.id, target.title);
            };

            if (anchor && anchor.parentElement) {
              anchor.parentElement.insertBefore(splitRightItem, anchor);
              anchor.parentElement.insertBefore(splitDownItem, anchor);
            } else {
              viewport.appendChild(splitRightItem);
              viewport.appendChild(splitDownItem);
            }
          });
        });

        observer.observe(document.body, { childList: true, subtree: true });
      }

      /* =======================================================================
       * 7. 拖拽与热区检测 (Antigravity 2.0 Multi-Pane Dropzone)
       * ======================================================================= */
      getCenterColumn() {
        return this.containerEl?.parentElement || document.querySelector('[data-dsh-claude-part="center-column"], ._6Qf49G_centerCol');
      }

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
            this.activeDragSession = { id: sessionId, title };

            if (this.containerEl) {
              this.containerEl.classList.add('dshd-is-dragging');
            }

            if (e.dataTransfer) {
              try {
                e.dataTransfer.setData('text/plain', sessionId || '');
                e.dataTransfer.effectAllowed = 'copyMove';
              } catch (dtErr) {
                console.debug('[dshd-split-view] dataTransfer error:', dtErr);
              }
            }
          }
        }, true);

        window.addEventListener('dragend', () => {
          this.activeDragSession = null;
          this.hideDropOverlay();
          if (this.containerEl) {
            this.containerEl.classList.remove('dshd-is-dragging');
          }
        }, true);

        window.addEventListener('dragover', (e) => {
          if (!this.activeDragSession) return;
          const centerCol = this.getCenterColumn();
          if (!centerCol) return;

          const cRect = centerCol.getBoundingClientRect();
          if (
            e.clientX < cRect.left || e.clientX > cRect.right ||
            e.clientY < cRect.top || e.clientY > cRect.bottom
          ) {
            this.hideDropOverlay();
            return;
          }

          e.preventDefault();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
          }

          const leaves = collectLeafNodes(this.layout.tree);
          const relX = e.clientX - cRect.left;
          const relY = e.clientY - cRect.top;

          if (leaves.length <= 1) {
            // 单窗格模式：以整个主视口为热区目标
            const singlePaneRect = { x: 0, y: 0, width: cRect.width, height: cRect.height };
            const drop = detectDropZone(singlePaneRect, relX, relY, 0.35);

            if (drop && drop.position !== 'none') {
              this.showDropOverlay(
                drop.rect,
                drop.position === 'center' ? '在此窗格打开' : `向${drop.position === 'right' ? '右' : drop.position === 'left' ? '左' : drop.position === 'bottom' ? '下' : '上'}分屏`,
                this.activeDragSession.title
              );
              this.currentDropAction = {
                targetPaneId: leaves[0]?.id || this.layout.focusedPaneId,
                position: drop.position,
                sessionId: this.activeDragSession.id,
                title: this.activeDragSession.title
              };
            } else {
              this.hideDropOverlay();
            }
            return;
          }

          // 多窗格模式：计算各窗格几何位置与热区
          const geom = computeLayoutGeometry(this.layout, {
            x: 0,
            y: 0,
            width: cRect.width,
            height: cRect.height
          }, DEFAULT_DIVIDER_SIZE);

          let targetPaneGeo = null;
          for (const p of geom.panes) {
            if (
              relX >= p.rect.x && relX <= p.rect.x + p.rect.width &&
              relY >= p.rect.y && relY <= p.rect.y + p.rect.height
            ) {
              targetPaneGeo = p;
              break;
            }
          }

          if (targetPaneGeo) {
            const drop = detectDropZone(targetPaneGeo.rect, relX, relY, 0.35);
            if (drop && drop.position !== 'none') {
              this.showDropOverlay(
                drop.rect,
                drop.position === 'center' ? '在此窗格打开' : `向${drop.position === 'right' ? '右' : drop.position === 'left' ? '左' : drop.position === 'bottom' ? '下' : '上'}分屏`,
                this.activeDragSession.title
              );
              this.currentDropAction = {
                targetPaneId: targetPaneGeo.id,
                position: drop.position,
                sessionId: this.activeDragSession.id,
                title: this.activeDragSession.title
              };
            } else {
              this.hideDropOverlay();
            }
          } else {
            this.hideDropOverlay();
          }
        }, true);

        window.addEventListener('drop', (e) => {
          if (this.currentDropAction) {
            e.preventDefault();
            const { targetPaneId, position, sessionId, title } = this.currentDropAction;
            this.handleDropAction(targetPaneId, position, sessionId, title);
            this.currentDropAction = null;
          }
          this.hideDropOverlay();
          this.activeDragSession = null;
          if (this.containerEl) {
            this.containerEl.classList.remove('dshd-is-dragging');
          }
        }, true);
      }

      showDropOverlay(rect, title, hint) {
        const centerCol = this.getCenterColumn();
        if (!centerCol || !rect) return;

        let overlay = centerCol.querySelector('.dshd-drop-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'dshd-drop-overlay';
          centerCol.appendChild(overlay);
        }

        overlay.style.display = 'flex';
        overlay.style.left = `${rect.x}px`;
        overlay.style.top = `${rect.y}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
        overlay.innerHTML = `
          <div class="dshd-drop-card">
            <span class="dshd-drop-icon">${SVG_ICONS.splitMenu}</span>
            <span class="dshd-drop-title">${title}</span>
            <span class="dshd-drop-hint">${hint || ''}</span>
          </div>
        `;
      }

      hideDropOverlay() {
        const centerCol = this.getCenterColumn();
        if (!centerCol) return;
        const overlay = centerCol.querySelector('.dshd-drop-overlay');
        if (overlay) {
          overlay.style.display = 'none';
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
      async splitPane(targetPaneId, dir = 'horizontal', newSessionId = null, newTitle = null, insertBefore = false) {
        await this.initBaseHtml();
        const leaves = collectLeafNodes(this.layout.tree);
        const currentActive = this.detectCurrentSession();

        let targetId = targetPaneId || this.layout.focusedPaneId;

        if (leaves.length === 1) {
          // 单窗格进入多窗格模式：保留主会话到第一个窗格
          const firstLeaf = leaves[0];
          firstLeaf.sessionId = firstLeaf.sessionId || currentActive.id;
          this.paneTitles[firstLeaf.id] = this.paneTitles[firstLeaf.id] || currentActive.title;
          targetId = firstLeaf.id;
        }

        const nextSessionId = newSessionId || (this.lastContextSession ? this.lastContextSession.id : currentActive.id);
        const nextTitle = newTitle || (this.lastContextSession ? this.lastContextSession.title : currentActive.title);

        this.layout = splitPaneInTree(this.layout, targetId, dir, nextSessionId, insertBefore);
        if (nextSessionId) {
          this.paneTitles[this.layout.focusedPaneId] = nextTitle || '会话';
        }

        this.saveLayout();
        this.mountOrUpdateContainer();
      }

      closePane(paneId) {
        const leaves = collectLeafNodes(this.layout.tree);
        if (leaves.length <= 1) return;

        this.layout = closePaneInTree(this.layout, paneId);
        delete this.paneTitles[paneId];

        const oldFrame = this.paneFrames.get(paneId);
        if (oldFrame) {
          try {
            oldFrame.srcdoc = '';
            oldFrame.src = 'about:blank';
          } catch (e) {
            console.debug('[dshd-split-view] clean iframe error:', e);
          }
          this.paneFrames.delete(paneId);
        }

        const oldEl = this.paneElements.get(paneId);
        if (oldEl) {
          oldEl.remove();
          this.paneElements.delete(paneId);
        }

        this.saveLayout();
        this.mountOrUpdateContainer();
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
        if (!paneId) return;
        this.layout.focusedPaneId = paneId;
        this.saveLayout();

        // 纯视觉焦点更新，绝不触碰和劫持左侧会话栏
        for (const [id, el] of this.paneElements.entries()) {
          el.classList.toggle('dshd-pane-focused', id === paneId);
        }
      }

      switchPaneSession(paneId, sessionId, title) {
        const leaves = collectLeafNodes(this.layout.tree);
        if (leaves.length <= 1) {
          // 单窗格模式下：切换原生会话
          const hostRow = document.querySelector('[data-row-key="session:' + sessionId + '"]');
          if (hostRow) {
            hostRow.click();
          }
          return;
        }

        const leaf = findNode(this.layout.tree, paneId);
        if (!leaf) return;
        leaf.sessionId = sessionId;
        this.paneTitles[paneId] = title || '会话';
        this.saveLayout();

        const paneEl = this.paneElements.get(paneId);
        if (paneEl) {
          const t = paneEl.querySelector('.dshd-pane-title');
          if (t) { t.textContent = title; t.title = title; }
        }

        const iframe = this.paneFrames.get(paneId);
        const win = iframe?.contentWindow;
        if (win) {
          const row = win.document.querySelector('[data-row-key="session:' + sessionId + '"]');
          if (row) {
            row.click();
          } else {
            const toggle = win.document.querySelector('button._3WPZCG_toggle, button[aria-label*="侧边栏"]');
            if (toggle) {
              toggle.click();
              setTimeout(() => {
                win.document.querySelector('[data-row-key="session:' + sessionId + '"]')?.click();
              }, 300);
            }
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

        const centerCol = document.querySelector('[data-dsh-claude-part="center-column"], ._6Qf49G_centerCol');
        if (!centerCol) {
          setTimeout(() => this.mountOrUpdateContainer(), 200);
          return;
        }

        centerCol.style.position = 'relative';

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

        const leaves = collectLeafNodes(this.layout.tree);
        const totalPanesCount = leaves.length;

        if (totalPanesCount <= 1) {
          // 单窗格模式：原生 main 渲染，隐藏 split container
          container.style.display = 'none';
          main.style.display = '';
          for (const [id, el] of this.paneElements.entries()) {
            el.remove();
          }
          this.paneElements.clear();
          this.paneFrames.clear();
          return;
        }

        // 多窗格模式：隐藏原生 main，显示 container
        main.style.display = 'none';
        container.style.display = 'block';

        const rect = container.getBoundingClientRect();
        const containerRect = {
          x: 0,
          y: 0,
          width: rect.width || centerCol.clientWidth || 1000,
          height: rect.height || centerCol.clientHeight || 800
        };

        const geometry = computeLayoutGeometry(this.layout, containerRect, DEFAULT_DIVIDER_SIZE);
        const alivePaneIds = new Set(geometry.panes.map(p => p.id));

        // 移除废弃窗格
        for (const [id, el] of this.paneElements.entries()) {
          if (!alivePaneIds.has(id)) {
            el.remove();
            this.paneElements.delete(id);
            this.paneFrames.delete(id);
          }
        }

        // 渲染或更新窗格
        geometry.panes.forEach(paneGeo => {
          const isFocused = paneGeo.id === this.layout.focusedPaneId;
          const title = this.paneTitles[paneGeo.id] || (paneGeo.sessionId ? this.getSessionInfo(paneGeo.sessionId).title : '会话');

          if (this.paneElements.has(paneGeo.id)) {
            // 平滑调整已有窗格尺寸，不销毁或重载 iframe
            const existingPane = this.paneElements.get(paneGeo.id);
            existingPane.style.left = `${paneGeo.rect.x}px`;
            existingPane.style.top = `${paneGeo.rect.y}px`;
            existingPane.style.width = `${paneGeo.rect.width}px`;
            existingPane.style.height = `${paneGeo.rect.height}px`;
            existingPane.classList.toggle('dshd-pane-focused', isFocused);

            const titleEl = existingPane.querySelector('.dshd-pane-title');
            if (titleEl) {
              titleEl.textContent = title;
              titleEl.title = title;
            }

            const maxBtn = existingPane.querySelector('.dshd-btn-max');
            if (maxBtn) {
              const isMax = this.layout.maximizedPaneId === paneGeo.id;
              maxBtn.innerHTML = isMax ? SVG_ICONS.restore : SVG_ICONS.maximize;
              maxBtn.title = isMax ? '还原窗格 (⌘⌥↵ / Ctrl+Alt+Enter)' : '最大化窗格 (⌘⌥↵ / Ctrl+Alt+Enter)';
            }
          } else {
            // 创建新窗格卡片
            const paneEl = document.createElement('div');
            paneEl.className = `dshd-pane ${isFocused ? 'dshd-pane-focused' : ''}`;
            paneEl.setAttribute('data-pane-id', paneGeo.id);
            paneEl.style.left = `${paneGeo.rect.x}px`;
            paneEl.style.top = `${paneGeo.rect.y}px`;
            paneEl.style.width = `${paneGeo.rect.width}px`;
            paneEl.style.height = `${paneGeo.rect.height}px`;

            // 顶部导航条
            const headerEl = document.createElement('div');
            headerEl.className = 'dshd-pane-header';

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
            maxBtn.className = 'dshd-icon-btn dshd-btn-max';
            maxBtn.title = this.layout.maximizedPaneId === paneGeo.id ? '还原窗格 (⌘⌥↵)' : '最大化窗格 (⌘⌥↵)';
            maxBtn.innerHTML = this.layout.maximizedPaneId === paneGeo.id ? SVG_ICONS.restore : SVG_ICONS.maximize;
            maxBtn.onclick = (e) => {
              e.stopPropagation();
              this.toggleMaximize(paneGeo.id);
            };

            actionsEl.appendChild(splitRightBtn);
            actionsEl.appendChild(splitDownBtn);
            actionsEl.appendChild(maxBtn);

            const sep = document.createElement('span');
            sep.className = 'dshd-action-divider';
            actionsEl.appendChild(sep);

            // 右上角专属关闭 X 按钮
            const closeBtn = document.createElement('button');
            closeBtn.className = 'dshd-icon-btn dshd-pane-close-btn';
            closeBtn.title = '关闭窗格 (⌘⌥W / Ctrl+Alt+W)';
            closeBtn.innerHTML = SVG_ICONS.close;
            closeBtn.onclick = (e) => {
              e.stopPropagation();
              this.closePane(paneGeo.id);
            };
            actionsEl.appendChild(closeBtn);

            headerEl.appendChild(tabEl);
            headerEl.appendChild(actionsEl);

            // 内容区域
            const bodyEl = document.createElement('div');
            bodyEl.className = 'dshd-pane-body';

            const iframe = document.createElement('iframe');
            iframe.className = 'dshd-pane-frame';
            iframe.srcdoc = this.generatePaneSrcDoc(paneGeo.id, paneGeo.sessionId || this.detectCurrentSession().id);
            bodyEl.appendChild(iframe);

            paneEl.appendChild(headerEl);
            paneEl.appendChild(bodyEl);
            container.appendChild(paneEl);

            this.paneElements.set(paneGeo.id, paneEl);
            this.paneFrames.set(paneGeo.id, iframe);
          }
        });

        // 渲染所有分割条
        const existingDividers = container.querySelectorAll('.dshd-split-divider');
        existingDividers.forEach(d => d.remove());

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

        this.containerEl?.classList.add('dshd-is-dragging');

        let rafId = null;
        const onMouseMove = (moveEvent) => {
          if (!this.draggingDivider) return;
          const currentPos = this.draggingDivider.direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
          const delta = currentPos - this.draggingDivider.startPos;

          if (rafId !== null) return;
          rafId = requestAnimationFrame(() => {
            rafId = null;
            if (!this.draggingDivider) return;
            this.layout.tree = resizeDividerInTree(
              this.layout.tree,
              this.draggingDivider.branchId,
              delta,
              this.draggingDivider.totalSize
            );
            this.draggingDivider.startPos = currentPos;
            this.renderLayoutGeometry();
          });
        };

        const onMouseUp = () => {
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          this.draggingDivider = null;
          this.containerEl?.classList.remove('dshd-is-dragging');
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

      if (typeof window === 'undefined') return;

      const isChildPane = window.parent !== window || !!window.__IS_DSHD_PANE__;

      if (isChildPane) {
        console.info('[dshd-split-view] Running inside isolated split pane frame: ' + (window.__DSHD_PANE_ID__ || 'unknown'));
        return;
      }

      console.info('[dshd-split-view] Antigravity 2.0 Native Multi-Pane Split Engine initialized on DeepSeek Harness Desktop.');
      const controller = new SplitViewController();
      window.__DSHD_CONTROLLER__ = controller;
      controller.init();
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
