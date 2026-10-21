# dshd-split-view

<div align="center">

**Native Multi-Session Split View Plugin for DeepSeek Harness Desktop**  
*Strictly reverse-engineered and derived from Antigravity 2.0 Split View architecture, supporting macOS & Windows*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-brightgreen.svg)]()
[![DeepSeek Harness](https://img.shields.io/badge/DSH-Desktop%20Compatible-orange.svg)]()

[简体中文](./README.md) | [English](./README.en.md)

</div>

---

## 📌 Background: Why Legacy Web Plugins Crash in Desktop Mode?

In DeepSeek Harness, legacy web-based split plugins (such as `luckybilly/dsh-split-view`) wrap the entire application in outer `<iframe>` tags. 

However, in **DeepSeek Harness Desktop (Electron)**:
1. **Preload Script Isolation Causes Boot Deadlock**: The Electron main process only injects `preload-app.cjs` into the `mainFrame`. Child iframes lack `window.dshDesktopBoot`, leaving `globalThis.__DSH_BOOT_READY__` unfulfilled forever. The UI hangs on `"Loading plugins…"` until it times out with `"⚠️ Not Ready / Reload"`.
2. **Desktop IPC Assertion Rejection**: Desktop IPC calls are guarded with `event.senderFrame === mainWindow.webContents.mainFrame`. Any request from child iframes fails with `rejected IPC from an unowned renderer`.
3. **Redundant UI Overhead**: Each iframe duplicates native window title bars, macOS traffic lights, and sidebars.

---

## 🚀 Architectural Revolution: Antigravity 2.0 Split Model

`dshd-split-view` completely replaces the broken iframe wrapping with the **native split view architecture of Antigravity 2.0**:

- **Native Single Process Execution**: Single sidebar, single window frame, with multi-pane conversation rendering inside the central workspace.
- **Binary Split Tree Engine**: Pure functional layout computations with boundary clamping to prevent crushed panes.
- **Antigravity 2.0 Ghost Drop Overlay**: Dragging sessions toward pane edges highlights a translucent blue target zone with instant split upon drop.
- **Cross-Platform Native Experience (macOS & Windows)**:
  - **macOS**: Native `⌘ Cmd` & `⌥ Option` shortcuts with traffic light inset clearance.
  - **Windows**: Native `Ctrl` & `Alt` shortcuts with window caption control clearance.

---

## ✨ Key Features

- 🔀 **Multi-Pane Arbitrary Binary Split (Horizontal & Vertical)**: Split right, split down, 2x2 grid, 3-column or multi-level nested layouts with zero hard-coded limits.
- 🛡️ **Master Left Sidebar Protection & Zero Interference**: Complete decoupling between central split pane scheduling and the master left sidebar. Splitting, focusing, closing, or navigating panes never hijacks or modifies the active sidebar row. Clicking a session in the sidebar smoothly loads it into the currently focused pane, perfectly matching modern IDE standards.
- ⚡ **Concurrent Live Interactive Conversations**: Powered by Antigravity-grade isolated context bridging, each split pane maintains its own live conversation transcript, streaming LLM outputs, tool call rendering, status badges, and interactive prompt input bar simultaneously.
- 🖱️ **Drag-and-Drop Auto-Split**: Drag any session from the sidebar into the workspace; an Antigravity 2.0 ghost drop overlay illuminates the edge zone and splits the pane on release.
- 📋 **Sidebar Context Menu Integration**: Right-click any conversation row or click its "..." button to directly access native, unclipped `Split Right / Split Down` menu actions.
- 🎨 **Exquisite UI with 3D Hover Elevation Shadow**: Hovering over any conversation pane renders a tactile 3D card elevation shadow and soft blue glow. The focused pane enjoys an active glow border with a pulsing status dot.
- ❌ **Dedicated Top-Right Close Button**: Every pane features an elegant `✕` close button with red accent hover micro-animations, smoothly closing the pane and automatically rebalancing remaining space.
- 📏 **Smooth Draggable Dividers**: Hover glow effect, pointer-events pass-through protection during drag, 60fps real-time proportional resize, boundary constraints, and layout persistence.
- 📁 **Split Group Folder & One-Click Restore**: When "+ New Session" is clicked or `⌘N` / `Ctrl+N` is pressed in multi-pane split view, the current split workspace is automatically archived into a dedicated "Split Group Folder" in the sidebar, cleanly exiting split view to display the 100% visible native blank new session page. Click "Restore" on the sidebar group card at any time to instantly restore the full multi-pane layout.
- 🔍 **One-Key Maximize / Restore**: Instantly expand the focused pane to full width/height and restore back cleanly.
- 💾 **Persistent Tree Layout**: Restores previous split structure across application reboots.

---

## ⌨️ Shortcuts Reference

| Action | macOS Shortcut | Windows / Linux Shortcut |
|---|---|---|
| **Split Right** | <kbd>⌘</kbd> + <kbd>⌥ Option</kbd> + <kbd>D</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>D</kbd> |
| **Split Down** | <kbd>⌘</kbd> + <kbd>⌥ Option</kbd> + <kbd>V</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>V</kbd> |
| **Close Focused Pane** | <kbd>⌘</kbd> + <kbd>⌥ Option</kbd> + <kbd>W</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>W</kbd> |
| **Maximize / Restore** | <kbd>⌘</kbd> + <kbd>⌥ Option</kbd> + <kbd>Enter</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>Enter</kbd> |

---

## 📦 Installation

```bash
cd ~/.dsh/profiles/desktop
pnpm add dshd-split-view
```

Ensure `cordis.patch.yml` includes the loader entry:
```yaml
- insert:
    - id: dshd-split-view
      name: 'dshd-split-view'
```

Restart DeepSeek Harness Desktop to enjoy multi-session split view without errors!

---

## 🧪 Unit Tests

Run the pure functional test suite:
```bash
npm test
```

---

## 📄 License

Licensed under the [MIT License](./LICENSE).

Copyright (c) 2026 Locke ([@locke-w](https://github.com/locke-w))
