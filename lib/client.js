/**
 * dshd-split-view - Antigravity 2.0 Native Multi-Session Split View
 * 
 * 专为 DeepSeek Harness Desktop (macOS & Windows) 打造的原生多会话分屏插件。
 * 严格参照 Antigravity 2.0 分屏交互模型与状态机架构设计：
 * 1. 单宿主单进程原生分屏，绝无 iframe 嵌套，彻底避免 Electron Preload 缺失与 IPC 死锁
 * 2. Antigravity 2.0 边缘拖拽热区判定与半透明蓝色高亮遮罩 (Ghost Drop Overlay)
 * 3. 完美适配侧边栏会话拖拽入工作区自动分屏 (Drag & Drop to Auto-Split)
 * 4. 自动适配 macOS (⌘) 与 Windows (Ctrl) 原生快捷键及窗口非客户区避让
 * 
 * @author Locke (locke-w)
 * @license MIT
 */

(function () {
  function factory(require) {
    var module = { exports: {} };
    var exports = module.exports;

    const STORAGE_KEY = 'dshd-split:layout:v2';
    const DEFAULT_DIVIDER_SIZE = 5;

    /* =========================================================================
     * 1. 样式定义与动态注入 (Antigravity 2.0 视觉规范)
     * ========================================================================= */
    const CSS_STYLES = `
:root {
  --dshd-brand-primary: #3b82f6;
  --dshd-brand-hover: #2563eb;
  --dshd-brand-ghost: rgba(59, 130, 246, 0.15);
  --dshd-brand-dropzone: rgba(59, 130, 246, 0.22);
  --dshd-brand-dropborder: rgba(59, 130, 246, 0.8);

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
  --dshd-divider-hover: #3b82f6;
  --dshd-divider-active: #2563eb;
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

/* 分屏容器主结构 */
#dshd-split-container {
  display: flex;
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  background-color: var(--dshd-bg-root);
}

.dshd-split-horizontal {
  flex-direction: row;
}

.dshd-split-vertical {
  flex-direction: column;
}

/* 单个分屏卡片 */
.dshd-pane {
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  background-color: var(--dshd-bg-pane);
  border: 1px solid var(--dshd-border-default);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  min-width: 160px;
  min-height: 120px;
}

.dshd-pane-focused {
  border-color: var(--dshd-border-focus) !important;
  box-shadow: 0 0 0 1px var(--dshd-brand-ghost);
  z-index: 2;
}

/* 窗格顶部导航条 */
.dshd-pane-header {
  height: 36px;
  min-height: 36px;
  background-color: var(--dshd-bg-header);
  border-bottom: 1px solid var(--dshd-border-default);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  user-select: none;
}

.dshd-pane-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 65%;
  padding: 3px 8px;
  border-radius: 6px;
  background-color: var(--dshd-bg-tab-active);
  border: 1px solid var(--dshd-border-default);
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--dshd-text-primary);
  font-size: 12px;
  font-weight: 500;
}

.dshd-pane-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
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
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--dshd-text-secondary);
  cursor: pointer;
  transition: all 0.12s ease;
  padding: 0;
}

.dshd-icon-btn:hover {
  background-color: var(--dshd-bg-tab-hover);
  color: var(--dshd-text-primary);
}

.dshd-icon-btn-danger:hover {
  background-color: rgba(239, 68, 68, 0.2);
  color: #ef4444;
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
  height: calc(100% - 36px);
}

/* 未激活窗格的点击捕获浮层 */
.dshd-pane-click-capture {
  position: absolute;
  inset: 0;
  z-index: 10;
  cursor: pointer;
  background: transparent;
}

/* 分割线 */
.dshd-split-divider {
  position: relative;
  z-index: 5;
  background-color: var(--dshd-divider-bg);
  transition: background-color 0.15s ease;
  flex-shrink: 0;
}

.dshd-split-divider:hover {
  background-color: var(--dshd-divider-hover) !important;
}

.dshd-split-divider-dragging {
  background-color: var(--dshd-divider-active) !important;
}

.dshd-divider-h {
  width: 5px;
  cursor: col-resize;
}

.dshd-divider-v {
  height: 5px;
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
  background: rgba(15, 23, 42, 0.9);
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
      maximize: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6 M9 21H3v-6 M21 3l-7 7 M3 21l7-7"/></svg>',
      restore: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6 M20 10h-6V4 M14 10l7-7 M10 14l-7 7"/></svg>',
      close: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18 M6 6l12 12"/></svg>',
      session: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
    };

    /* =========================================================================
     * 3. 平台检测与辅助
     * ========================================================================= */
    function detectPlatform() {
      if (typeof navigator === 'undefined') return 'macos';
      const p = navigator.platform ? navigator.platform.toLowerCase() : '';
      if (p.includes('mac')) return 'macos';
      if (p.includes('win')) return 'windows';
      return 'macos';
    }

    /* =========================================================================
     * 4. Antigravity 2.0 Split View 核心控制器 (DOM & Layout Manager)
     * ========================================================================= */
    class SplitViewController {
      constructor() {
        this.panes = []; // [{ id, sessionId, title, ratio, snapshotEl }]
        this.direction = 'horizontal'; // 'horizontal' | 'vertical'
        this.focusedPaneId = null;
        this.maximizedPaneId = null;
        this.activeDragSession = null;
        this.containerEl = null;
        this.mainEl = null;
        this.isDraggingDivider = false;
      }

      init() {
        ensureStylesInjected();
        this.restoreLayout();
        this.setupDndListeners();
        this.setupKeyboardListeners();
        this.mountOrUpdateContainer();
      }

      restoreLayout() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const data = JSON.parse(raw);
            if (Array.isArray(data.panes) && data.panes.length > 0) {
              this.panes = data.panes;
              this.direction = data.direction || 'horizontal';
              this.focusedPaneId = data.focusedPaneId || this.panes[0].id;
              this.maximizedPaneId = data.maximizedPaneId || null;
              return;
            }
          }
        } catch (e) {
          console.warn('[dshd-split-view] Restore layout failed:', e);
        }

        // 初始单窗格
        const initialId = 'pane_' + Math.random().toString(36).slice(2, 7);
        const currentSession = this.detectCurrentSession();
        this.panes = [{
          id: initialId,
          sessionId: currentSession.id,
          title: currentSession.title || '主会话',
          ratio: 1.0
        }];
        this.focusedPaneId = initialId;
      }

      saveLayout() {
        try {
          const toSave = {
            panes: this.panes.map(p => ({
              id: p.id,
              sessionId: p.sessionId,
              title: p.title,
              ratio: p.ratio
            })),
            direction: this.direction,
            focusedPaneId: this.focusedPaneId,
            maximizedPaneId: this.maximizedPaneId
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
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
       * 5. 拖拽与热区检测 (Antigravity 2.0 Ghost Dropzone)
       * ======================================================================= */
      setupDndListeners() {
        if (typeof window === 'undefined') return;

        // 全局捕获 dragstart：识别侧边栏会话拖拽
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

        // 全局捕获 dragover：必须 preventDefault 解锁光标 🚫，并展示 Antigravity 高亮遮罩
        window.addEventListener('dragover', (e) => {
          const centerCol = document.querySelector('[data-dsh-claude-part="center-column"]');
          if (!centerCol) return;

          const centerRect = centerCol.getBoundingClientRect();
          const inCenter = (
            e.clientX >= centerRect.left &&
            e.clientX <= centerRect.right &&
            e.clientY >= centerRect.top &&
            e.clientY <= centerRect.bottom
          );

          if (inCenter) {
            // **关键点**：阻止默认行为，光标从 🚫 变为允许放置
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';

            // 查找光标当前悬停的 Pane，如果未分屏则以 centerCol 为基准
            let targetRect = centerRect;

            if (this.panes.length > 1) {
              const paneEls = centerCol.querySelectorAll('.dshd-pane');
              for (const el of paneEls) {
                const pr = el.getBoundingClientRect();
                if (
                  e.clientX >= pr.left &&
                  e.clientX <= pr.right &&
                  e.clientY >= pr.top &&
                  e.clientY <= pr.bottom
                ) {
                  targetRect = pr;
                  break;
                }
              }
            }

            // 计算热区位置
            const zone = this.calculateDropZone(targetRect, e.clientX, e.clientY);
            this.showDropOverlay(zone.rect, zone.position);
          } else {
            this.hideDropOverlay();
          }
        }, true);

        // 离开窗口或结束拖拽
        window.addEventListener('dragleave', (e) => {
          if (!e.relatedTarget) {
            this.hideDropOverlay();
          }
        }, true);

        window.addEventListener('dragend', () => {
          this.hideDropOverlay();
          this.activeDragSession = null;
        }, true);

        // 全局捕获 drop：执行自动分屏
        window.addEventListener('drop', (e) => {
          const centerCol = document.querySelector('[data-dsh-claude-part="center-column"]');
          if (!centerCol) return;

          const centerRect = centerCol.getBoundingClientRect();
          const inCenter = (
            e.clientX >= centerRect.left &&
            e.clientX <= centerRect.right &&
            e.clientY >= centerRect.top &&
            e.clientY <= centerRect.bottom
          );

          if (inCenter) {
            e.preventDefault();
            this.hideDropOverlay();

            // 提取拖拽的会话
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
              let targetPaneId = this.focusedPaneId || this.panes[0]?.id;
              let targetRect = centerRect;

              if (this.panes.length > 1) {
                const paneEls = centerCol.querySelectorAll('.dshd-pane');
                for (const el of paneEls) {
                  const pr = el.getBoundingClientRect();
                  if (
                    e.clientX >= pr.left &&
                    e.clientX <= pr.right &&
                    e.clientY >= pr.top &&
                    e.clientY <= pr.bottom
                  ) {
                    targetPaneId = el.getAttribute('data-pane-id');
                    targetRect = pr;
                    break;
                  }
                }
              }

              const zone = this.calculateDropZone(targetRect, e.clientX, e.clientY);
              this.handleDropAction(targetPaneId, zone.position, sessionId, title);
            }

            this.activeDragSession = null;
          }
        }, true);
      }

      calculateDropZone(rect, clientX, clientY) {
        const relX = clientX - rect.left;
        const relY = clientY - rect.top;
        const w = rect.width;
        const h = rect.height;

        const ratio = 0.35; // 边缘 35% 判定为拆分
        const leftThreshold = w * ratio;
        const rightThreshold = w * (1 - ratio);
        const topThreshold = h * ratio;
        const bottomThreshold = h * (1 - ratio);

        if (relX >= rightThreshold) {
          return {
            position: 'right',
            rect: {
              left: rect.left + w / 2,
              top: rect.top,
              width: w / 2,
              height: h
            }
          };
        }
        if (relX <= leftThreshold) {
          return {
            position: 'left',
            rect: {
              left: rect.left,
              top: rect.top,
              width: w / 2,
              height: h
            }
          };
        }
        if (relY >= bottomThreshold) {
          return {
            position: 'bottom',
            rect: {
              left: rect.left,
              top: rect.top + h / 2,
              width: w,
              height: h / 2
            }
          };
        }
        if (relY <= topThreshold) {
          return {
            position: 'top',
            rect: {
              left: rect.left,
              top: rect.top,
              width: w,
              height: h / 2
            }
          };
        }

        return {
          position: 'center',
          rect: {
            left: rect.left,
            top: rect.top,
            width: w,
            height: h
          }
        };
      }

      showDropOverlay(rect, position) {
        let overlay = document.getElementById('dshd-drop-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'dshd-drop-overlay';
          document.body.appendChild(overlay);
        }

        overlay.style.left = `${rect.left}px`;
        overlay.style.top = `${rect.top}px`;
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
          // center: 切换当前 Pane 的会话
          this.switchPaneSession(targetPaneId, sessionId, title);
        }
      }

      /* =======================================================================
       * 6. 分屏操作与状态机
       * ======================================================================= */
      splitPane(targetPaneId, dir = 'horizontal', newSessionId = null, newTitle = null, insertBefore = false) {
        const newId = 'pane_' + Math.random().toString(36).slice(2, 7);
        const info = newSessionId ? { id: newSessionId, title: newTitle || '会话' } : this.detectCurrentSession();

        const newPane = {
          id: newId,
          sessionId: info.id,
          title: info.title || '新窗格',
          ratio: 0.5
        };

        this.direction = dir;
        this.maximizedPaneId = null;

        // 保存当前活跃 pane 的快照
        this.snapshotActivePane();

        if (this.panes.length === 1) {
          this.panes[0].ratio = 0.5;
          newPane.ratio = 0.5;
          if (insertBefore) {
            this.panes.unshift(newPane);
          } else {
            this.panes.push(newPane);
          }
        } else {
          newPane.ratio = 0.5;
          this.panes[0].ratio = 0.5;
          this.panes[1] = newPane;
        }

        this.focusedPaneId = newId;
        this.saveLayout();
        this.mountOrUpdateContainer();

        if (newSessionId) {
          this.openSession(newSessionId);
        }
      }

      closePane(paneId) {
        if (this.panes.length <= 1) {
          return; // 最后一个窗格不关闭
        }

        this.panes = this.panes.filter(p => p.id !== paneId);
        if (this.panes.length > 0) {
          this.panes[0].ratio = 1.0;
          this.focusedPaneId = this.panes[0].id;
        }
        this.maximizedPaneId = null;

        this.saveLayout();
        this.mountOrUpdateContainer();

        const activePane = this.panes[0];
        if (activePane && activePane.sessionId) {
          this.openSession(activePane.sessionId);
        }
      }

      toggleMaximize(paneId) {
        if (this.maximizedPaneId === paneId) {
          this.maximizedPaneId = null;
        } else {
          this.maximizedPaneId = paneId;
        }
        this.saveLayout();
        this.mountOrUpdateContainer();
      }

      focusPane(paneId) {
        if (this.focusedPaneId === paneId) return;

        // 保存当前活跃 pane 的 DOM 静态快照
        this.snapshotActivePane();

        this.focusedPaneId = paneId;
        this.saveLayout();
        this.mountOrUpdateContainer();

        const p = this.panes.find(item => item.id === paneId);
        if (p && p.sessionId) {
          this.openSession(p.sessionId);
        }
      }

      switchPaneSession(paneId, sessionId, title) {
        const p = this.panes.find(item => item.id === paneId);
        if (p) {
          p.sessionId = sessionId;
          p.title = title || p.title;
          this.focusedPaneId = paneId;
          this.saveLayout();
          this.mountOrUpdateContainer();
          this.openSession(sessionId);
        }
      }

      snapshotActivePane() {
        const focusedPane = this.panes.find(p => p.id === this.focusedPaneId);
        if (!focusedPane) return;

        const main = this.mainEl || document.querySelector('[data-slot="main"]');
        if (main) {
          const root = main.querySelector('.ST7X_W_root');
          if (root) {
            focusedPane.snapshotEl = root.cloneNode(true);
          }
        }
      }

      /* =======================================================================
       * 7. 快捷键
       * ======================================================================= */
      setupKeyboardListeners() {
        if (typeof window === 'undefined') return;

        window.addEventListener('keydown', (e) => {
          const isMac = detectPlatform() === 'macos';
          const modifier = isMac ? e.metaKey : e.ctrlKey;
          if (!modifier || !e.altKey) return;

          const currentId = this.focusedPaneId || this.panes[0]?.id;

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
       * 8. DOM 挂载与动态更新 (确保保护 main 绝不被销毁)
       * ======================================================================= */
      mountOrUpdateContainer() {
        if (typeof document === 'undefined') return;

        const centerCol = document.querySelector('[data-dsh-claude-part="center-column"]');
        if (!centerCol) {
          setTimeout(() => this.mountOrUpdateContainer(), 200);
          return;
        }

        // 优先查找并持久缓存 main DOM
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
        }

        // **关键保护**：在重建 container 之前，把 main 移出到 centerCol，避免被 innerHTML = '' 销毁！
        if (main.parentElement && main.parentElement !== centerCol) {
          centerCol.appendChild(main);
        }

        // 设置容器排版类名
        container.className = this.direction === 'horizontal' ? 'dshd-split-horizontal' : 'dshd-split-vertical';

        // 清空现有子元素重建
        container.innerHTML = '';

        // 如果处于最大化模式
        const activePanes = this.maximizedPaneId
          ? this.panes.filter(p => p.id === this.maximizedPaneId)
          : this.panes;

        activePanes.forEach((pane, idx) => {
          const isFocused = (pane.id === this.focusedPaneId) || (activePanes.length === 1);

          const paneEl = document.createElement('div');
          paneEl.className = `dshd-pane ${isFocused ? 'dshd-pane-focused' : ''}`;
          paneEl.setAttribute('data-pane-id', pane.id);

          const sizePercent = activePanes.length === 1 ? 100 : (pane.ratio * 100);
          if (this.direction === 'horizontal') {
            paneEl.style.flex = `0 0 calc(${sizePercent}% - ${activePanes.length > 1 ? 2.5 : 0}px)`;
            paneEl.style.height = '100%';
          } else {
            paneEl.style.flex = `0 0 calc(${sizePercent}% - ${activePanes.length > 1 ? 2.5 : 0}px)`;
            paneEl.style.width = '100%';
          }

          // Header
          const headerEl = document.createElement('div');
          headerEl.className = 'dshd-pane-header';

          const tabEl = document.createElement('div');
          tabEl.className = 'dshd-pane-tab';
          tabEl.innerHTML = `${SVG_ICONS.session}<span class="dshd-pane-title">${pane.title || '会话'}</span>`;
          tabEl.onclick = () => this.focusPane(pane.id);

          const actionsEl = document.createElement('div');
          actionsEl.className = 'dshd-pane-actions';

          // Split Right btn
          const splitRightBtn = document.createElement('button');
          splitRightBtn.className = 'dshd-icon-btn';
          splitRightBtn.title = '向右分屏 (⌘⌥D / Ctrl+Alt+D)';
          splitRightBtn.innerHTML = SVG_ICONS.splitRight;
          splitRightBtn.onclick = (e) => {
            e.stopPropagation();
            this.splitPane(pane.id, 'horizontal');
          };

          // Split Down btn
          const splitDownBtn = document.createElement('button');
          splitDownBtn.className = 'dshd-icon-btn';
          splitDownBtn.title = '向下分屏 (⌘⌥V / Ctrl+Alt+V)';
          splitDownBtn.innerHTML = SVG_ICONS.splitDown;
          splitDownBtn.onclick = (e) => {
            e.stopPropagation();
            this.splitPane(pane.id, 'vertical');
          };

          // Maximize btn
          const maxBtn = document.createElement('button');
          maxBtn.className = 'dshd-icon-btn';
          maxBtn.title = this.maximizedPaneId === pane.id ? '还原窗格 (⌘⌥↵)' : '最大化窗格 (⌘⌥↵)';
          maxBtn.innerHTML = this.maximizedPaneId === pane.id ? SVG_ICONS.restore : SVG_ICONS.maximize;
          maxBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleMaximize(pane.id);
          };

          actionsEl.appendChild(splitRightBtn);
          actionsEl.appendChild(splitDownBtn);
          actionsEl.appendChild(maxBtn);

          // Close btn (当窗格大于1个时显示)
          if (this.panes.length > 1) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'dshd-icon-btn dshd-icon-btn-danger';
            closeBtn.title = '关闭窗格 (⌘⌥W / Ctrl+Alt+W)';
            closeBtn.innerHTML = SVG_ICONS.close;
            closeBtn.onclick = (e) => {
              e.stopPropagation();
              this.closePane(pane.id);
            };
            actionsEl.appendChild(closeBtn);
          }

          headerEl.appendChild(tabEl);
          headerEl.appendChild(actionsEl);

          // Body
          const bodyEl = document.createElement('div');
          bodyEl.className = 'dshd-pane-body';

          if (isFocused) {
            // 聚焦窗格承载活体主会话 DOM
            bodyEl.appendChild(main);
          } else {
            // 未聚焦窗格展示快照内容并覆盖快速聚焦层
            if (pane.snapshotEl) {
              bodyEl.appendChild(pane.snapshotEl.cloneNode(true));
            } else {
              const placeholder = document.createElement('div');
              placeholder.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:var(--dshd-text-secondary);font-size:13px;flex-direction:column;gap:8px;';
              placeholder.innerHTML = `${SVG_ICONS.session}<div>点击激活 ${pane.title}</div>`;
              bodyEl.appendChild(placeholder);
            }

            const clickCapture = document.createElement('div');
            clickCapture.className = 'dshd-pane-click-capture';
            clickCapture.onclick = () => this.focusPane(pane.id);
            bodyEl.appendChild(clickCapture);
          }

          paneEl.appendChild(headerEl);
          paneEl.appendChild(bodyEl);
          container.appendChild(paneEl);

          // 插入 Divider (在第1和第2个窗格之间)
          if (idx === 0 && activePanes.length > 1) {
            const dividerEl = document.createElement('div');
            dividerEl.className = `dshd-split-divider ${this.direction === 'horizontal' ? 'dshd-divider-h' : 'dshd-divider-v'}`;
            
            dividerEl.onmousedown = (e) => {
              e.preventDefault();
              this.startDividerDrag(e, activePanes[0], activePanes[1]);
            };

            container.appendChild(dividerEl);
          }
        });
      }

      startDividerDrag(e, pane1, pane2) {
        this.isDraggingDivider = true;
        const container = document.getElementById('dshd-split-container');
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const isH = this.direction === 'horizontal';
        const startPos = isH ? e.clientX : e.clientY;
        const totalSize = isH ? containerRect.width : containerRect.height;
        const startRatio = pane1.ratio;

        const dividerEl = container.querySelector('.dshd-split-divider');
        if (dividerEl) dividerEl.classList.add('dshd-split-divider-dragging');

        const onMouseMove = (moveEvent) => {
          if (!this.isDraggingDivider) return;
          const currentPos = isH ? moveEvent.clientX : moveEvent.clientY;
          const delta = currentPos - startPos;
          const deltaRatio = delta / totalSize;

          let newRatio = Math.max(0.15, Math.min(0.85, startRatio + deltaRatio));
          pane1.ratio = newRatio;
          pane2.ratio = 1.0 - newRatio;

          const paneEls = container.querySelectorAll('.dshd-pane');
          if (paneEls[0] && paneEls[1]) {
            const p1Size = `calc(${newRatio * 100}% - 2.5px)`;
            const p2Size = `calc(${(1.0 - newRatio) * 100}% - 2.5px)`;
            paneEls[0].style.flex = `0 0 ${p1Size}`;
            paneEls[1].style.flex = `0 0 ${p2Size}`;
          }
        };

        const onMouseUp = () => {
          this.isDraggingDivider = false;
          if (dividerEl) dividerEl.classList.remove('dshd-split-divider-dragging');
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
          this.saveLayout();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      }
    }

    /* =========================================================================
     * 9. Cordis 客户端插件入口与导出
     * ========================================================================= */
    const inject = ['slots', 'sessions', 'theme', 'locale'];

    function apply(ctx) {
      ensureStylesInjected();
      console.info('[dshd-split-view] Antigravity 2.0 Native Split Engine initialized on DeepSeek Harness Desktop.');

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
