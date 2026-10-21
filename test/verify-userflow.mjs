/**
 * End-to-End Userflow Verification Script for dshd-split-view
 * 
 * Verifies:
 * 1. P0 Defect 1: Direct, unclipped context menu split actions (向右分屏 / 向下分屏)
 * 2. P0 Defect 2: Single-pane drag-and-drop ghost overlay and edge split
 * 3. Multi-pane vertical split (3-pane layout)
 * 4. Close button (✕) and clean layout rebalance
 */

import { createCdpClient } from './cdp.mjs';
import { join } from 'node:path';

const brainDir = '/Users/wuyongjia/.gemini/antigravity/brain/add36118-4f1d-4320-a4d1-0fef957ce611';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForSelector(client, selector, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const exists = await client.evaluate(`!!document.querySelector(${JSON.stringify(selector)})`);
    if (exists) return true;
    await sleep(250);
  }
  throw new Error(`Timeout waiting for selector: ${selector}`);
}

async function run() {
  console.log('=== Starting dshd-split-view End-to-End Userflow Verification ===');
  const client = await createCdpClient(9333);
  console.log('Connected to DSH via CDP:', client.target.title);

  // ----------------------------------------------------
  // Phase 1: Reset to Single-Pane State
  // ----------------------------------------------------
  console.log('\n[Phase 1] Resetting to single-pane state...');
  await client.evaluate(`
    (function() {
      localStorage.removeItem('dshd_split_layout');
      localStorage.removeItem('dshd_split_titles');
      if (window.__DSHD_CONTROLLER__) {
        window.__DSHD_CONTROLLER__.layout = {
          tree: { kind: 'leaf', id: 'pane_default', sessionId: null },
          focusedPaneId: 'pane_default',
          maximizedPaneId: null
        };
        window.__DSHD_CONTROLLER__.saveLayout();
        window.__DSHD_CONTROLLER__.mountOrUpdateContainer();
      }
    })()
  `);
  await sleep(600);

  const initialCheck = await client.evaluate(`
    (function() {
      const container = document.getElementById('dshd-split-container');
      const main = document.querySelector('[data-slot="main"]');
      return {
        containerDisplay: container ? window.getComputedStyle(container).display : null,
        mainDisplay: main ? window.getComputedStyle(main).display : null
      };
    })()
  `);
  console.log('Initial single-pane state:', initialCheck);

  // ----------------------------------------------------
  // Phase 2: Test Defect 1 - Context Menu Direct Actions
  // ----------------------------------------------------
  console.log('\n[Phase 2] Testing Context Menu Direct Split Actions...');
  await waitForSelector(client, '[data-row-key^="session:"]');

  // Trigger context menu on the first session row
  await client.evaluate(`
    (function() {
      const sessionRow = document.querySelector('[data-row-key^="session:"]');
      if (!sessionRow) return;
      sessionRow.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      const btn = sessionRow.querySelector('button[aria-label*="的操作"]');
      if (btn) btn.click();
    })()
  `);
  await sleep(600);

  await waitForSelector(client, '[role="menu"]');
  const menuInfo = await client.evaluate(`
    (function() {
      const menu = document.querySelector('[role="menu"]');
      if (!menu) return { hasMenu: false };
      const splitButtons = Array.from(menu.querySelectorAll('.dshd-menu-split-item button'));
      return {
        hasMenu: true,
        itemCount: splitButtons.length,
        items: splitButtons.map(b => b.innerText.trim()),
        menuRect: {
          x: menu.getBoundingClientRect().x,
          y: menu.getBoundingClientRect().y,
          width: menu.getBoundingClientRect().width,
          height: menu.getBoundingClientRect().height
        }
      };
    })()
  `);
  console.log('Injected context menu info:', menuInfo);

  const menuScreenshot = join(brainDir, 'dshd_context_menu_direct_verified.png');
  await client.captureScreenshot(menuScreenshot);
  console.log('Evidence saved: dshd_context_menu_direct_verified.png');

  if (menuInfo.itemCount < 2) {
    throw new Error('Verification failed: Context menu did not inject 2 direct split actions!');
  }

  // Click "向右分屏"
  console.log('Clicking "向右分屏" (Split Right)...');
  await client.evaluate(`
    (function() {
      const rightBtn = document.querySelector('[data-dshd-action="split-right"]');
      if (rightBtn) rightBtn.click();
    })()
  `);
  await sleep(1500);

  const splitFromMenuResult = await client.evaluate(`
    (function() {
      const container = document.getElementById('dshd-split-container');
      const panes = document.querySelectorAll('.dshd-pane');
      return {
        containerDisplay: container ? window.getComputedStyle(container).display : null,
        panesCount: panes.length,
        titles: Array.from(panes).map(p => p.querySelector('.dshd-pane-title')?.innerText)
      };
    })()
  `);
  console.log('Result after menu split right:', splitFromMenuResult);
  const splitMenuScreenshot = join(brainDir, 'dshd_split_from_menu_verified.png');
  await client.captureScreenshot(splitMenuScreenshot);
  console.log('Evidence saved: dshd_split_from_menu_verified.png');

  if (splitFromMenuResult.panesCount !== 2) {
    throw new Error('Menu split failed to transition to 2 panes!');
  }

  // ----------------------------------------------------
  // Phase 3: Test Defect 2 - Drag-and-Drop from Single Pane
  // ----------------------------------------------------
  console.log('\n[Phase 3] Testing Drag-and-Drop in Single-Pane Mode...');
  // Reset back to 1 pane
  await client.evaluate(`
    (function() {
      if (window.__DSHD_CONTROLLER__) {
        window.__DSHD_CONTROLLER__.layout = {
          tree: { kind: 'leaf', id: 'pane_default', sessionId: null },
          focusedPaneId: 'pane_default',
          maximizedPaneId: null
        };
        window.__DSHD_CONTROLLER__.saveLayout();
        window.__DSHD_CONTROLLER__.mountOrUpdateContainer();
      }
    })()
  `);
  await sleep(600);

  await waitForSelector(client, '[data-row-key^="session:"]');

  console.log('Simulating dragstart on session row...');
  const dndOverlayInfo = await client.evaluate(`
    (function() {
      const sessionRow = document.querySelector('[data-row-key^="session:"]');
      const centerCol = document.querySelector('[data-dsh-claude-part="center-column"], ._6Qf49G_centerCol');
      if (!sessionRow || !centerCol) return { success: false, reason: 'no sessionRow or centerCol' };

      const dt = new DataTransfer();
      const dragStartEvt = new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt
      });
      sessionRow.dispatchEvent(dragStartEvt);

      const cRect = centerCol.getBoundingClientRect();
      // Target 85% width (right split zone)
      const targetX = cRect.left + cRect.width * 0.85;
      const targetY = cRect.top + cRect.height * 0.5;

      const dragOverEvt = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        clientX: targetX,
        clientY: targetY,
        dataTransfer: dt
      });
      window.dispatchEvent(dragOverEvt);

      const overlay = centerCol.querySelector('.dshd-drop-overlay');
      return {
        success: true,
        overlayVisible: overlay && window.getComputedStyle(overlay).display !== 'none',
        overlayRect: overlay ? {
          left: overlay.style.left,
          top: overlay.style.top,
          width: overlay.style.width,
          height: overlay.style.height
        } : null,
        title: overlay ? overlay.querySelector('.dshd-drop-title')?.innerText : null,
        hint: overlay ? overlay.querySelector('.dshd-drop-hint')?.innerText : null
      };
    })()
  `);
  console.log('DnD ghost overlay info:', dndOverlayInfo);

  const dndOverlayScreenshot = join(brainDir, 'dshd_single_pane_dnd_overlay_verified.png');
  await client.captureScreenshot(dndOverlayScreenshot);
  console.log('Evidence saved: dshd_single_pane_dnd_overlay_verified.png');

  if (!dndOverlayInfo.overlayVisible) {
    throw new Error('DnD ghost overlay failed to display in single-pane mode!');
  }

  // Dispatch drop
  console.log('Dispatching drop event on right zone...');
  await client.evaluate(`
    (function() {
      const centerCol = document.querySelector('[data-dsh-claude-part="center-column"], ._6Qf49G_centerCol');
      const cRect = centerCol.getBoundingClientRect();
      const dropEvt = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        clientX: cRect.left + cRect.width * 0.85,
        clientY: cRect.top + cRect.height * 0.5,
        dataTransfer: new DataTransfer()
      });
      window.dispatchEvent(dropEvt);
    })()
  `);
  await sleep(1500);

  const dndResult = await client.evaluate(`
    (function() {
      const container = document.getElementById('dshd-split-container');
      const panes = document.querySelectorAll('.dshd-pane');
      return {
        containerDisplay: container ? window.getComputedStyle(container).display : null,
        panesCount: panes.length,
        titles: Array.from(panes).map(p => p.querySelector('.dshd-pane-title')?.innerText)
      };
    })()
  `);
  console.log('Result after single-pane drop:', dndResult);
  const dndResultScreenshot = join(brainDir, 'dshd_single_pane_dnd_result_verified.png');
  await client.captureScreenshot(dndResultScreenshot);
  console.log('Evidence saved: dshd_single_pane_dnd_result_verified.png');

  if (dndResult.panesCount !== 2) {
    throw new Error('DnD drop failed to split single pane into 2 panes!');
  }

  // ----------------------------------------------------
  // Phase 4: Multi-Pane Split (3-Pane Layout)
  // ----------------------------------------------------
  console.log('\n[Phase 4] Splitting vertically into 3 panes...');
  await client.evaluate(`
    (function() {
      const panes = document.querySelectorAll('.dshd-pane');
      const targetPane = panes[panes.length - 1];
      const splitDownBtn = targetPane.querySelector('[title*="向下拆分"]');
      if (splitDownBtn) {
        splitDownBtn.click();
      }
    })()
  `);
  await sleep(1500);

  const threePaneResult = await client.evaluate(`
    (function() {
      const panes = document.querySelectorAll('.dshd-pane');
      return {
        panesCount: panes.length,
        titles: Array.from(panes).map(p => p.querySelector('.dshd-pane-title')?.innerText)
      };
    })()
  `);
  console.log('Result after 3-pane vertical split:', threePaneResult);
  const threePaneScreenshot = join(brainDir, 'dshd_split_3pane_vertical_verified.png');
  await client.captureScreenshot(threePaneScreenshot);
  console.log('Evidence saved: dshd_split_3pane_vertical_verified.png');

  if (threePaneResult.panesCount !== 3) {
    throw new Error('Vertical split failed to create 3 panes!');
  }

  // ----------------------------------------------------
  // Phase 5: Test Close Button (✕) and Rebalance
  // ----------------------------------------------------
  console.log('\n[Phase 5] Closing a pane via top-right close button (✕)...');
  await client.evaluate(`
    (function() {
      const closeButtons = document.querySelectorAll('.dshd-pane-close-btn');
      if (closeButtons.length > 0) {
        closeButtons[closeButtons.length - 1].click();
      }
    })()
  `);
  await sleep(1200);

  const afterCloseResult = await client.evaluate(`
    (function() {
      const panes = document.querySelectorAll('.dshd-pane');
      return {
        panesCount: panes.length,
        titles: Array.from(panes).map(p => p.querySelector('.dshd-pane-title')?.innerText)
      };
    })()
  `);
  console.log('Result after closing 1 pane:', afterCloseResult);
  const afterCloseScreenshot = join(brainDir, 'dshd_after_close_rebalanced.png');
  await client.captureScreenshot(afterCloseScreenshot);
  console.log('Evidence saved: dshd_after_close_rebalanced.png');

  if (afterCloseResult.panesCount !== 2) {
    throw new Error('Close button failed to rebalance layout to 2 panes!');
  }

  client.close();
  console.log('\n=== All Userflow Verification Assertions Passed Successfully! ===');
}

run().catch(err => {
  console.error('\nVerification Error:', err);
  process.exit(1);
});
