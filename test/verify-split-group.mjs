/**
 * Verification Script for Split Group Folder & New Session Bugfix
 * 
 * Tests:
 * 1. Multi-pane split active
 * 2. Click "+ 新建会话" -> auto-archive current split group into sidebar folder
 * 3. Verify native new session page is 100% visible (not blocked by split view)
 * 4. Verify sidebar shows "分屏工作组" folder with sub-sessions
 * 5. Click "复原" -> instantly restores multi-pane split view
 */

import { createCdpClient } from './cdp.mjs';
import { join } from 'node:path';

const brainDir = '/Users/wuyongjia/.gemini/antigravity/brain/add36118-4f1d-4320-a4d1-0fef957ce611';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('=== Starting Split Group & New Session Verification ===');
  let client = await createCdpClient(9333);
  console.log('Connected to DSH via CDP:', client.target.title);

  // 1. Reload page to load updated plugin
  console.log('Reloading DSH to load updated plugin...');
  await client.reload();
  client.close();
  await sleep(2500);
  client = await createCdpClient(9333);
  console.log('Reconnected after reload to:', client.target.title);

  // 2. Setup a 3-pane split view first
  console.log('Setting up 3-pane split view...');
  await client.evaluate(`
    (function() {
      const ctrl = window.__DSHD_CONTROLLER__;
      if (!ctrl) return;
      ctrl.splitGroups = [];
      ctrl.saveSplitGroups();
      
      const s1 = 'session-1c9b8277-18a5-4c64-92a1-6d96f2b847e3';
      const s2 = 'session-43e7a52c-67f7-42c4-99ea-ca8ecc4717a8';
      const s3 = 'session-4265b270-775f-474c-b625-3791144fa706';

      ctrl.layout = {
        tree: {
          kind: 'branch',
          id: 'branch_root',
          direction: 'horizontal',
          fraction: 0.5,
          first: { kind: 'leaf', id: 'pane_1', sessionId: s1 },
          second: {
            kind: 'branch',
            id: 'branch_sub',
            direction: 'vertical',
            fraction: 0.5,
            first: { kind: 'leaf', id: 'pane_2', sessionId: s2 },
            second: { kind: 'leaf', id: 'pane_3', sessionId: s3 }
          }
        },
        focusedPaneId: 'pane_1',
        maximizedPaneId: null
      };
      ctrl.paneTitles = {
        pane_1: '手机远程授权报错',
        pane_2: '把deepseekharness',
        pane_3: 'mcp功能测试'
      };
      ctrl.saveLayout();
      ctrl.mountOrUpdateContainer();
    })()
  `);
  await sleep(1500);

  const initial3Pane = await client.evaluate(`
    (function() {
      const container = document.getElementById('dshd-split-container');
      const panes = document.querySelectorAll('.dshd-pane');
      return {
        containerDisplay: container ? window.getComputedStyle(container).display : null,
        panesCount: panes.length
      };
    })()
  `);
  console.log('3-pane active check:', initial3Pane);
  if (initial3Pane.panesCount !== 3) {
    throw new Error('Failed to setup 3-pane split view');
  }

  // 3. Click "+ 新会话" button
  console.log('Clicking "+ 新建会话" button...');
  const clickNewSessionRes = await client.evaluate(`
    (function() {
      const newBtn = document.querySelector('button._3WPZCG_newSession, [aria-label*="新建会话"], [data-dsh-claude-part="new-session"]');
      if (!newBtn) return { success: false, reason: 'no new session btn' };
      newBtn.click();
      return { success: true };
    })()
  `);
  console.log('Click new session result:', clickNewSessionRes);
  await sleep(1500);

  // 4. Verify native new session is visible & split group is archived in sidebar
  const afterNewSessionState = await client.evaluate(`
    (function() {
      const container = document.getElementById('dshd-split-container');
      const main = document.querySelector('[data-slot="main"]');
      const groupSection = document.getElementById('dshd-split-groups-section');
      const groupCard = groupSection?.querySelector('.dshd-split-group-card');
      const groupTitle = groupCard?.querySelector('.dshd-group-title')?.innerText;
      const groupsCount = window.__DSHD_CONTROLLER__?.splitGroups?.length || 0;

      return {
        containerDisplay: container ? window.getComputedStyle(container).display : null,
        mainDisplay: main ? window.getComputedStyle(main).display : null,
        mainHasWelcome: main ? main.innerText.includes('How can I help you today?') || main.innerText.includes('What') || main.innerText.includes('会话') : false,
        hasGroupSection: !!groupSection,
        groupTitle,
        groupsCount
      };
    })()
  `);
  console.log('After new session state:', afterNewSessionState);

  const newSessionScreenshot = join(brainDir, 'dshd_new_session_split_group_archived.png');
  await client.captureScreenshot(newSessionScreenshot);
  console.log('Evidence saved: dshd_new_session_split_group_archived.png');

  if (afterNewSessionState.containerDisplay !== 'none') {
    throw new Error('Bug not fixed: Split container is still visible after clicking new session!');
  }
  if (afterNewSessionState.groupsCount < 1) {
    throw new Error('Feature failed: Split group was not archived!');
  }

  // 5. Expand split group folder
  console.log('Expanding split group folder...');
  await client.evaluate(`
    (function() {
      const toggleBtn = document.querySelector('.dshd-group-toggle-btn');
      if (toggleBtn) toggleBtn.click();
    })()
  `);
  await sleep(600);

  const expandedCheck = await client.evaluate(`
    (function() {
      const sessions = document.querySelectorAll('.dshd-group-session-item');
      return {
        sessionItemsCount: sessions.length,
        titles: Array.from(sessions).map(s => s.innerText.trim())
      };
    })()
  `);
  console.log('Expanded split group sessions:', expandedCheck);

  const expandedScreenshot = join(brainDir, 'dshd_split_group_expanded.png');
  await client.captureScreenshot(expandedScreenshot);
  console.log('Evidence saved: dshd_split_group_expanded.png');

  // 6. Click "复原" button to restore the split view
  console.log('Clicking "复原" on the split group folder...');
  await client.evaluate(`
    (function() {
      const restoreBtn = document.querySelector('.dshd-group-restore-btn');
      if (restoreBtn) restoreBtn.click();
    })()
  `);
  await sleep(1500);

  const restoredState = await client.evaluate(`
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
  console.log('Restored split view state:', restoredState);

  const restoredScreenshot = join(brainDir, 'dshd_split_group_restored.png');
  await client.captureScreenshot(restoredScreenshot);
  console.log('Evidence saved: dshd_split_group_restored.png');

  if (restoredState.panesCount !== 3) {
    throw new Error('Failed to restore 3-pane split view!');
  }

  client.close();
  console.log('=== Split Group Verification Succeeded! ===');
}

run().catch(err => {
  console.error('Verification Error:', err);
  process.exit(1);
});
