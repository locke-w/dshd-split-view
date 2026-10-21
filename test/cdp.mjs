// CDP Helper for DeepSeek Harness testing
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

export async function createCdpClient(port = 9333) {
  try {
    if (process.platform === 'darwin') {
      execSync('osascript -e \'tell application "DeepSeek Harness" to activate\'', { stdio: 'ignore' });
    }
  } catch (_) {}
  const targetsRes = await fetch(`http://127.0.0.1:${port}/json`);
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.type === 'page' && t.url.startsWith('dsh-app://')) || targets[0];
  if (!pageTarget) {
    throw new Error('No page target found on port ' + port);
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          resolve(msg.result);
        }
      }
    } catch (e) {
      console.error('WS parse error:', e);
    }
  };

  async function send(method, params = {}) {
    const curId = id++;
    return new Promise((resolve, reject) => {
      pending.set(curId, { resolve, reject });
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error('Eval error: ' + (res.exceptionDetails.exception?.description || JSON.stringify(res.exceptionDetails)));
    }
    return res.result?.value;
  }

  async function captureScreenshot(filepath) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    writeFileSync(filepath, buffer);
    return filepath;
  }

  async function reload() {
    await send('Page.reload', { ignoreCache: true });
    // wait for page load
    await new Promise(r => setTimeout(r, 2000));
  }

  function close() {
    ws.close();
  }

  return {
    send,
    evaluate,
    captureScreenshot,
    reload,
    close,
    target: pageTarget
  };
}

if (process.argv[1] && process.argv[1].endsWith('cdp.mjs')) {
  // Direct CLI invocation test
  const expr = process.argv[2] || '({ title: document.title, url: location.href })';
  const client = await createCdpClient();
  console.log('Connected to:', client.target.title);
  const result = await client.evaluate(expr);
  console.log('Eval result:', result);
  client.close();
}
