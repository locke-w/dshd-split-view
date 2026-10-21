import { createCdpClient } from './cdp.mjs';

async function main() {
  const cdp = await createCdpClient();
  console.log('Connected to target:', cdp.target.title);

  // Configure clean 3-pane tree:
  // Root: Vertical branch (top / bottom, 50% fraction)
  //   First: Leaf "pane_top" (session-43e7a52c-67f7-42c4-99ea-ca8ecc4717a8)
  //   Second: Horizontal branch (left / right, 50% fraction)
  //     First: Leaf "pane_bottom_left" (session-4265b270-775f-474c-b625-3791144fa706)
  //     Second: Leaf "pane_bottom_right" (session-1c9b8277-18a5-4c64-92a1-6d96f2b847e3)
  const setupResult = await cdp.evaluate(`
    (async () => {
      const c = window.__DSHD_CONTROLLER__;
      await c.initBaseHtml();

      const tree = {
        kind: 'branch',
        id: 'branch_root_vert',
        direction: 'vertical',
        fraction: 0.5,
        first: {
          kind: 'leaf',
          id: 'pane_top',
          sessionId: 'session-43e7a52c-67f7-42c4-99ea-ca8ecc4717a8'
        },
        second: {
          kind: 'branch',
          id: 'branch_bottom_horiz',
          direction: 'horizontal',
          fraction: 0.5,
          first: {
            kind: 'leaf',
            id: 'pane_bl',
            sessionId: 'session-4265b270-775f-474c-b625-3791144fa706'
          },
          second: {
            kind: 'leaf',
            id: 'pane_br',
            sessionId: 'session-1c9b8277-18a5-4c64-92a1-6d96f2b847e3'
          }
        }
      };

      c.layout = {
        tree,
        focusedPaneId: 'pane_bl',
        maximizedPaneId: null
      };

      c.paneTitles = {
        pane_top: '有没有可以把deepseekharnessdesktop',
        pane_bl: 'deepseekharnessdesktop有mcp功能吗',
        pane_br: 'dsh-web-all手机远程授权报错'
      };

      c.saveLayout();
      c.renderLayoutGeometry();

      return {
        panesRendered: c.paneElements.size,
        framesCount: c.paneFrames.size
      };
    })()
  `);

  console.log('3-Pane layout configured:', setupResult);

  // Wait 3.5s for all 3 child iframes to boot and render conversations
  console.log('Waiting 3.5s for iframes to render conversations concurrently...');
  await new Promise(r => setTimeout(r, 3500));

  // Inspect status of the 3 panes and the left sidebar
  const status = await cdp.evaluate(`
    (() => {
      const c = window.__DSHD_CONTROLLER__;
      const paneTop = c.paneFrames.get('pane_top')?.contentWindow;
      const paneBl = c.paneFrames.get('pane_bl')?.contentWindow;
      const paneBr = c.paneFrames.get('pane_br')?.contentWindow;

      const sidebar = document.querySelector('[data-slot="sidebar"]');
      const activeSidebarRow = document.querySelector('[data-row-key][aria-selected="true"]')?.getAttribute('data-row-key');

      return {
        sidebarIntact: !!sidebar && sidebar.offsetWidth > 0,
        activeSidebarRow,
        panes: [
          {
            id: 'pane_top',
            title: c.paneTitles['pane_top'],
            focused: c.layout.focusedPaneId === 'pane_top',
            hasCloseBtn: !!c.paneElements.get('pane_top')?.querySelector('.dshd-pane-close-btn'),
            titleInFrame: paneTop?.document?.title,
            frameConversationPreview: paneTop?.document?.querySelector('[data-slot="main"]')?.innerText?.slice(0, 80)
          },
          {
            id: 'pane_bl',
            title: c.paneTitles['pane_bl'],
            focused: c.layout.focusedPaneId === 'pane_bl',
            hasCloseBtn: !!c.paneElements.get('pane_bl')?.querySelector('.dshd-pane-close-btn'),
            titleInFrame: paneBl?.document?.title,
            frameConversationPreview: paneBl?.document?.querySelector('[data-slot="main"]')?.innerText?.slice(0, 80)
          },
          {
            id: 'pane_br',
            title: c.paneTitles['pane_br'],
            focused: c.layout.focusedPaneId === 'pane_br',
            hasCloseBtn: !!c.paneElements.get('pane_br')?.querySelector('.dshd-pane-close-btn'),
            titleInFrame: paneBr?.document?.title,
            frameConversationPreview: paneBr?.document?.querySelector('[data-slot="main"]')?.innerText?.slice(0, 80)
          }
        ]
      };
    })()
  `);

  console.log('\n--- 3-PANE STATUS ---');
  console.log('Left Sidebar Intact:', status.sidebarIntact);
  console.log('Master Sidebar Active Row:', status.activeSidebarRow);
  status.panes.forEach(p => {
    console.log(`\nPane [${p.id}]`);
    console.log(`  Title: ${p.title}`);
    console.log(`  Focused: ${p.focused}`);
    console.log(`  Has Close 'X' Button: ${p.hasCloseBtn}`);
    console.log(`  Iframe Title: ${p.titleInFrame}`);
    console.log(`  Iframe Conversation: ${p.frameConversationPreview?.replace(/\n/g, ' ')}`);
  });

  // Capture screenshot of the 3-pane layout
  const screenshotPath = '/Users/wuyongjia/.gemini/antigravity/brain/add36118-4f1d-4320-a4d1-0fef957ce611/dshd_split_3pane_verified_final.png';
  await cdp.captureScreenshot(screenshotPath);
  console.log('\nScreenshot successfully captured to:', screenshotPath);

  // Test Hover styling on bottom-right pane
  console.log('\nTesting hover effect on bottom-right pane...');
  await cdp.evaluate(`
    (() => {
      const el = window.__DSHD_CONTROLLER__.paneElements.get('pane_br');
      if (el) {
        // Dispatch mouseenter
        el.dispatchEvent(new MouseEvent('mouseenter'));
      }
    })()
  `);

  const hoverScreenshotPath = '/Users/wuyongjia/.gemini/antigravity/brain/add36118-4f1d-4320-a4d1-0fef957ce611/dshd_split_3pane_hover_evidence.png';
  await cdp.captureScreenshot(hoverScreenshotPath);
  console.log('Hover screenshot captured to:', hoverScreenshotPath);

  // Test close 'X' button on pane_br:
  console.log('\nTesting close button on pane_br...');
  const closeResult = await cdp.evaluate(`
    (() => {
      const c = window.__DSHD_CONTROLLER__;
      const closeBtn = c.paneElements.get('pane_br')?.querySelector('.dshd-pane-close-btn');
      if (closeBtn) {
        closeBtn.click();
      }
      return {
        remainingPanes: c.paneElements.size,
        remainingPaneIds: Array.from(c.paneElements.keys()),
        sidebarIntact: document.querySelector('[data-slot="sidebar"]')?.offsetWidth > 0
      };
    })()
  `);
  console.log('Close result:', closeResult);

  // Wait 1s and capture 2-pane screenshot
  await new Promise(r => setTimeout(r, 1000));
  const postCloseScreenshot = '/Users/wuyongjia/.gemini/antigravity/brain/add36118-4f1d-4320-a4d1-0fef957ce611/dshd_split_2pane_live.png';
  await cdp.captureScreenshot(postCloseScreenshot);
  console.log('Post-close screenshot captured to:', postCloseScreenshot);

  cdp.close();
}

main().catch(console.error);
