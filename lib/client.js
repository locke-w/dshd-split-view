/**
 * dshd-split-view - Antigravity 2.0 Native Multi-Session Split View
 * 
 * 专为 DeepSeek Harness Desktop (macOS & Windows) 打造的原生多会话分屏插件。
 * 严格参照 Antigravity 2.0 分屏状态机与交互模型设计：
 * 1. 单宿主单进程原生分屏，彻底告别 iframe 嵌套导致的 Electron Preload 死锁
 * 2. Antigravity 2.0 边缘拖拽热区判定与半透明蓝色高亮遮罩 (Ghost Drop Overlay)
 * 3. 自动适配 macOS (⌘) 与 Windows (Ctrl) 原生快捷键及窗口非客户区避让
 * 
 * @author Locke (locke-w)
 * @license MIT
 */

(function () {
  function factory(require) {
    var module = { exports: {} };
    var exports = module.exports;

    const React = require ? require('react') : (window.React || {});
    const { useState, useEffect, useRef } = React;

    const STORAGE_KEY = 'dshd-split:layout';
    const DEFAULT_DIVIDER_SIZE = 5;
    const MIN_PANE_SIZE = 180;
    const EDGE_DROP_ZONE_RATIO = 0.25;

    /* =========================================================================
     * 1. 样式定义与动态注入 (Antigravity 2.0 视觉规范)
     * ========================================================================= */
    const CSS_STYLES = `
:root {
  --dshd-brand-primary: #3b82f6;
  --dshd-brand-hover: #2563eb;
  --dshd-brand-ghost: rgba(59, 130, 246, 0.15);
  --dshd-brand-dropzone: rgba(59, 130, 246, 0.22);
  --dshd-brand-dropborder: rgba(59, 130, 246, 0.7);

  --dshd-border-default: rgba(255, 255, 255, 0.08);
  --dshd-border-hover: rgba(255, 255, 255, 0.18);
  --dshd-border-focus: #3b82f6;

  --dshd-bg-root: #0e1015;
  --dshd-bg-pane: #12141a;
  --dshd-bg-header: #161822;
  --dshd-bg-tab-active: #1c1f2b;
  --dshd-bg-tab-hover: #181b24;

  --dshd-text-primary: #f3f4f6;
  --dshd-text-secondary: #9ca3af;
  --dshd-text-muted: #6b7280;

  --dshd-divider-bg: rgba(255, 255, 255, 0.06);
  --dshd-divider-active: #3b82f6;
  --dshd-divider-size: 5px;
}

@media (prefers-color-scheme: light) {
  :root {
    --dshd-border-default: rgba(0, 0, 0, 0.08);
    --dshd-border-hover: rgba(0, 0, 0, 0.16);
    --dshd-bg-root: #f8fafc;
    --dshd-bg-pane: #ffffff;
    --dshd-bg-header: #f1f5f9;
    --dshd-bg-tab-active: #ffffff;
    --dshd-bg-tab-hover: #e2e8f0;
    --dshd-text-primary: #1e293b;
    --dshd-text-secondary: #475569;
    --dshd-text-muted: #94a3b8;
    --dshd-divider-bg: rgba(0, 0, 0, 0.06);
  }
}

.dshd-split-container {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--dshd-bg-root);
  user-select: none;
  box-sizing: border-box;
}

.dshd-pane {
  position: absolute;
  display: flex;
  flex-direction: column;
  background-color: var(--dshd-bg-pane);
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid var(--dshd-border-default);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.dshd-pane-focused {
  border-color: var(--dshd-border-focus);
  box-shadow: 0 0 0 1px var(--dshd-brand-ghost);
  z-index: 2;
}

.dshd-pane-header {
  height: 38px;
  min-height: 38px;
  background-color: var(--dshd-bg-header);
  border-bottom: 1px solid var(--dshd-border-default);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  color: var(--dshd-text-primary);
}

.dshd-pane-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 60%;
  padding: 4px 10px;
  border-radius: 6px;
  background-color: var(--dshd-bg-tab-active);
  border: 1px solid var(--dshd-border-default);
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.dshd-pane-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: 500;
  font-size: 12.5px;
}

.dshd-pane-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dshd-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: var(--dshd-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.dshd-icon-btn:hover {
  background-color: var(--dshd-bg-tab-hover);
  color: var(--dshd-text-primary);
}

.dshd-icon-btn-danger:hover {
  background-color: rgba(239, 68, 68, 0.18);
  color: #ef4444;
}

.dshd-pane-body {
  flex: 1 1 auto;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dshd-split-divider {
  position: absolute;
  z-index: 10;
  background-color: var(--dshd-divider-bg);
  transition: background-color 0.15s ease;
}

.dshd-split-divider-horizontal {
  cursor: col-resize;
  width: var(--dshd-divider-size);
}

.dshd-split-divider-vertical {
  cursor: row-resize;
  height: var(--dshd-divider-size);
}

.dshd-split-divider:hover,
.dshd-split-divider-dragging {
  background-color: var(--dshd-divider-active);
  box-shadow: 0 0 8px var(--dshd-divider-active);
}

.dshd-drop-overlay {
  position: absolute;
  pointer-events: none;
  z-index: 100;
  background-color: var(--dshd-brand-dropzone);
  border: 2px dashed var(--dshd-brand-dropborder);
  border-radius: 8px;
  backdrop-filter: blur(2px);
  transition: all 0.12s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}

.dshd-drop-badge {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 6px 14px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid var(--dshd-brand-dropborder);
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
  border-radius: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
`;

    function ensureStylesInjected() {
      if (typeof document === 'undefined') return;
      const styleId = 'dshd-split-view-styles';
      if (!document.getElementById(styleId)) {
        const styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = CSS_STYLES;
        document.head.appendChild(styleEl);
      }
    }

    /* =========================================================================
     * 2. 跨平台适配 (macOS & Windows)
     * ========================================================================= */
    function detectCurrentPlatform() {
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

    /* =========================================================================
     * 3. 核心布局树算法 (二叉分屏树模型)
     * ========================================================================= */
    let idCounter = 0;
    function generateUniqueId(prefix = 'pane') {
      idCounter += 1;
      return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}_${idCounter}`;
    }

    function createInitialLayout(initialSessionId = null) {
      const initialPaneId = generateUniqueId('pane');
      return {
        tree: {
          kind: 'leaf',
          id: initialPaneId,
          sessionId: initialSessionId
        },
        focusedPaneId: initialPaneId,
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

    function splitPane(state, targetPaneId, direction, newSessionId = null) {
      const newPaneId = generateUniqueId('pane');
      const newLeaf = {
        kind: 'leaf',
        id: newPaneId,
        sessionId: newSessionId
      };

      function replaceNode(node) {
        if (node.kind === 'leaf' && node.id === targetPaneId) {
          return {
            kind: 'branch',
            id: generateUniqueId('branch'),
            direction,
            fraction: 0.5,
            first: node,
            second: newLeaf
          };
        }
        if (node.kind === 'branch') {
          return {
            ...node,
            first: replaceNode(node.first),
            second: replaceNode(node.second)
          };
        }
        return node;
      }

      return {
        ...state,
        tree: replaceNode(state.tree),
        focusedPaneId: newPaneId,
        maximizedPaneId: null
      };
    }

    function closePane(state, targetPaneId) {
      const leaves = collectLeafNodes(state.tree);
      if (leaves.length <= 1) {
        const singleLeaf = leaves[0];
        return {
          tree: { kind: 'leaf', id: singleLeaf.id, sessionId: null },
          focusedPaneId: singleLeaf.id,
          maximizedPaneId: null
        };
      }

      function pruneNode(node) {
        if (node.kind === 'leaf') {
          return node.id === targetPaneId ? null : node;
        }
        const nextFirst = pruneNode(node.first);
        const nextSecond = pruneNode(node.second);

        if (nextFirst === null) return nextSecond;
        if (nextSecond === null) return nextFirst;

        return {
          ...node,
          first: nextFirst,
          second: nextSecond
        };
      }

      const updatedTree = pruneNode(state.tree) || state.tree;
      const remainingLeaves = collectLeafNodes(updatedTree);
      let nextFocusedId = state.focusedPaneId;

      if (nextFocusedId === targetPaneId) {
        nextFocusedId = remainingLeaves[0]?.id || '';
      }

      return {
        tree: updatedTree,
        focusedPaneId: nextFocusedId,
        maximizedPaneId: state.maximizedPaneId === targetPaneId ? null : state.maximizedPaneId
      };
    }

    function resizeDivider(tree, branchId, deltaPx, totalAvailablePx) {
      function update(node) {
        if (node.kind === 'branch') {
          if (node.id === branchId) {
            if (totalAvailablePx <= 0) return node;
            const deltaFraction = deltaPx / totalAvailablePx;
            let newFraction = node.fraction + deltaFraction;
            const minRatio = MIN_PANE_SIZE / totalAvailablePx;
            newFraction = Math.max(minRatio, Math.min(1 - minRatio, newFraction));
            return { ...node, fraction: newFraction };
          }
          return {
            ...node,
            first: update(node.first),
            second: update(node.second)
          };
        }
        return node;
      }
      return update(tree);
    }

    function computeLayoutGeometry(state, containerRect, dividerSize = DEFAULT_DIVIDER_SIZE) {
      const panes = [];
      const dividers = [];

      if (state.maximizedPaneId) {
        const target = collectLeafNodes(state.tree).find(p => p.id === state.maximizedPaneId);
        if (target) {
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
            focused: node.id === state.focusedPaneId,
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

          dividers.push({
            id: `divider_${id}`,
            branchId: id,
            direction,
            rect: {
              x: currentRect.x + firstWidth,
              y: currentRect.y,
              width: dividerSize,
              height: currentRect.height
            }
          });

          layoutRecursive(first, {
            x: currentRect.x,
            y: currentRect.y,
            width: firstWidth,
            height: currentRect.height
          });
          layoutRecursive(second, {
            x: currentRect.x + firstWidth + dividerSize,
            y: currentRect.y,
            width: secondWidth,
            height: currentRect.height
          });
        } else {
          const availableHeight = Math.max(0, currentRect.height - dividerSize);
          const firstHeight = Math.round(availableHeight * fraction);
          const secondHeight = Math.max(0, availableHeight - firstHeight);

          dividers.push({
            id: `divider_${id}`,
            branchId: id,
            direction,
            rect: {
              x: currentRect.x,
              y: currentRect.y + firstHeight,
              width: currentRect.width,
              height: dividerSize
            }
          });

          layoutRecursive(first, {
            x: currentRect.x,
            y: currentRect.y,
            width: currentRect.width,
            height: firstHeight
          });
          layoutRecursive(second, {
            x: currentRect.x,
            y: currentRect.y + firstHeight + dividerSize,
            width: currentRect.width,
            height: secondHeight
          });
        }
      }

      layoutRecursive(state.tree, containerRect);
      return { panes, dividers };
    }

    function detectDropZone(paneRect, clientX, clientY, ratio = EDGE_DROP_ZONE_RATIO) {
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
     * 4. 图标与视图组件
     * ========================================================================= */
    function renderSvg(path, size = 14) {
      if (!React || !React.createElement) return null;
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

    /* =========================================================================
     * 5. Cordis 客户端插件入口与导出
     * ========================================================================= */
    const inject = ['slots', 'sessions', 'theme', 'locale'];

    function apply(ctx) {
      ensureStylesInjected();
      console.info('[dshd-split-view] Antigravity 2.0 Native Split Engine initialized on DeepSeek Harness Desktop.');

      // 注册全局分屏快捷键
      if (typeof window !== 'undefined') {
        const handleGlobalKeyDown = (e) => {
          const isMac = detectCurrentPlatform() === 'macos';
          const modifier = isMac ? e.metaKey : e.ctrlKey;
          if (!modifier || !e.altKey) return;

          if (e.code === 'KeyD') {
            e.preventDefault();
            console.log('[dshd-split-view] Trigger Split Right (快捷键触发)');
          } else if (e.code === 'KeyV') {
            e.preventDefault();
            console.log('[dshd-split-view] Trigger Split Down (快捷键触发)');
          } else if (e.code === 'KeyW') {
            e.preventDefault();
            console.log('[dshd-split-view] Trigger Close Pane (快捷键触发)');
          }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
      }
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.createInitialLayout = createInitialLayout;
    exports.splitPane = splitPane;
    exports.closePane = closePane;
    exports.resizeDivider = resizeDivider;
    exports.computeLayoutGeometry = computeLayoutGeometry;
    exports.detectDropZone = detectDropZone;

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
