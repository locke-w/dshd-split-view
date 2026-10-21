# dshd-split-view

<div align="center">

**为 DeepSeek Harness Desktop 量身打造的原生多会话分屏插件**  
*严格逆向并参考 Antigravity 2.0 分屏架构设计，完美支持 macOS 与 Windows 原生双平台*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-brightgreen.svg)]()
[![DeepSeek Harness](https://img.shields.io/badge/DSH-Desktop%20Compatible-orange.svg)]()

[简体中文](./README.md) | [English](./README.en.md)

</div>

---

## 📌 背景与痛点：旧版 `dsh-split-view` 为什么在桌面端崩溃？

在 DeepSeek Harness 官方插件生态中，传统的 Web 分屏插件（如 `luckybilly/dsh-split-view`）采用了**外层全量 `<iframe>` 嵌套方案**：把整个 DSH 客户端放进 4 个 iframe 中独立运行。

然而在 **DeepSeek Harness Desktop (Electron 桌面版)** 中，这会触发致命的架构级死锁：
1. **Preload 脚本隔离导致启动死锁**：Electron 桌面主进程为了安全性，默认**仅向主渲染帧（`mainFrame`）注入 `preload-app.cjs`**。子 iframe 内的 `window.dshDesktopBoot` 为 `undefined`，导致页面内注入的 `globalThis.__DSH_BOOT_READY__` 的 Promise 永远得不到 resolve，所有分屏永久停留在「`Loading plugins…` / 启动中…」，8 秒后超时报错「`⚠️ 未就绪·重载`」。
2. **桌面端 IPC 强安全校验拦截**：桌面端主进程对于工作区选择、快捷键与原生系统调用设置了强校验（`event.senderFrame === mainWindow.webContents.mainFrame`），直接抛出 `rejected IPC from an unowned renderer` 异常。
3. **内存与界面冗余**：每个分屏都强行加载了重复的 macOS 交通灯、标题栏与侧边栏，性能极低。

---

## 🚀 核心架构革新：Antigravity 2.0 原生分屏逻辑

`dshd-split-view` 彻底颠覆了旧版外挂 iframe 的方式，**严格逆向并对齐 Antigravity 2.0 的原生工作区拆分架构**：

- **单宿主单进程（Native Single Host & Process）**：保留全局唯一的原生侧边栏与标题栏，在中心工作区直接进行会话视口的多窗格渲染。
- **纯函数二叉分屏树（Binary Split Tree Engine）**：状态模型基于纯二叉树递归计算，具备毫秒级响应、零闪烁与数学级的几何边界保护（防止窗格过度压缩）。
- **Antigravity 2.0 风格的边缘拖拽热区高亮（Ghost Drop Overlay）**：拖拽会话 Tab 或侧边栏至窗格四周时，自动浮现优雅的半透明蓝色高光占位区，松手即可瞬间完成对半拆分。
- **双平台深度适配（macOS & Windows Native）**：
  - **macOS**：优先适配 `⌘ (Cmd)` 与 `⌥ (Option)` 快捷键，完美避让 macOS 隐藏式标题栏（hiddenInset）与红黄绿交通灯区域；
  - **Windows**：自适应 `Ctrl` 与 `Alt` 快捷键，自动避让 Windows 窗口控制按钮（Caption Controls）。

---

## ✨ 核心特性

- 🔀 **横竖任意嵌套与多窗格分屏**：支持向右分屏（Horizontal Split）、向下分屏（Vertical Split），支持左右双列、上下堆叠、3 窗格复合布局、4 窗格 2x2 田字格任意二叉树拓扑。
- 🖱️ **侧边栏拖拽自动分屏**：直接从左侧会话列表将任意会话卡片拖拽至编辑区，自动触发 Antigravity 2.0 风格的半透明蓝色边缘热区高光（Ghost Drop Overlay），鼠标靠近上下左右边缘松手即可毫秒级自动完成对应方向的拆分。
- 📋 **侧边栏右键菜单无缝集成**：右键点击侧边栏任意会话或点击「...」操作按钮，自动注入原生体验的「分屏 (Split) > 向右分屏 (Split Right) / 向下分屏 (Split Down)」子菜单，一键在新窗格中开启目标会话。
- 📏 **平滑可拖拽分割条**：高亮悬浮发光反馈，支持拖拽实时计算与比例记忆，内置边界保护防止窗格过度压缩。
- 🎯 **聚焦与多会话联动**：点击任意窗格即获焦点，与左侧会话历史实时双向联动，主窗格 DOM 受到深度保护不破坏 React Fiber 节点。
- 🔍 **快捷键一键最大化**：聚焦某个窗格时一键放大占满中心区域，再次点击无损还原。
- 💾 **布局状态自动记忆**：关闭应用后重新打开，自动恢复上一次的分屏树形结构。
- 🛡️ **优雅防御式降级**：若检测到单会话场景或极端异常，100% 回退至宿主原生单视口，绝不白屏卡死。

---

## ⌨️ 跨平台快捷键速查

| 操作 | macOS 快捷键 | Windows / Linux 快捷键 |
|---|---|---|
| **向右分屏** | <kbd>⌘</kbd> + <kbd>⌥ Option</kbd> + <kbd>D</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>D</kbd> |
| **向下分屏** | <kbd>⌘</kbd> + <kbd>⌥ Option</kbd> + <kbd>V</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>V</kbd> |
| **关闭当前窗格** | <kbd>⌘</kbd> + <kbd>⌥ Option</kbd> + <kbd>W</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>W</kbd> |
| **最大化 / 还原** | <kbd>⌘</kbd> + <kbd>⌥ Option</kbd> + <kbd>Enter</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Enter</kbd> |

---

## 📦 安装与启用指引

### 方式一：在 DeepSeek Harness Desktop 中安装

```bash
# 1. 切换至 DSH 桌面配置目录
cd ~/.dsh/profiles/desktop

# 2. 安装 dshd-split-view
pnpm add dshd-split-view
```

在 `~/.dsh/profiles/desktop/cordis.patch.yml` 中确保启用：
```yaml
- insert:
    - id: dshd-split-view
      name: 'dshd-split-view'
```

重启 DeepSeek Harness Desktop 即可享受原汁原味的原生多会话分屏！

---

## 🧪 单元测试

本项目核心算法经受了高标准的自动化单元测试覆盖：

```bash
npm test
```

测试套件涵盖：
- `createInitialLayout` 单窗格初始化
- `splitPane` 水平与垂直拓扑分裂
- `closePane` 窗格修剪与相邻兄弟节点提升重平衡
- `computeLayoutGeometry` 空间几何计算
- `detectDropZone` Antigravity 2.0 边缘拖拽热区判定

---

## 📄 开源许可证

本项目基于 [MIT License](./LICENSE) 协议开源。欢迎 Star 与 PR 贡献！

Copyright (c) 2026 Locke ([@locke-w](https://github.com/locke-w))
