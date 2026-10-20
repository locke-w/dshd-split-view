/**
 * dshd-split-view 布局算法单元测试
 * 
 * 验证 Antigravity 2.0 分屏树算法的鲁棒性：
 * 1. 初始状态
 * 2. 水平与垂直分屏
 * 3. 窗格关闭与兄弟节点自动提升
 * 4. 几何坐标与分割条计算
 * 5. 拖拽边缘热区判定
 * 
 * @author Locke (locke-w)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialLayout,
  splitPane,
  closePane,
  resizeDivider,
  computeLayoutGeometry,
  detectDropZone,
  collectLeafNodes
} from '../src/core/layoutEngine.ts';

test('createInitialLayout 应该正确创建单窗格初始布局', () => {
  const layout = createInitialLayout('session_123');
  assert.equal(layout.tree.kind, 'leaf');
  assert.equal(layout.tree.sessionId, 'session_123');
  assert.equal(layout.focusedPaneId, layout.tree.id);
  assert.equal(layout.maximizedPaneId, null);
});

test('splitPane 应该向右成功拆分为两个窗格', () => {
  const initial = createInitialLayout('session_1');
  const initialLeafId = initial.tree.id;

  const splitted = splitPane(initial, initialLeafId, 'horizontal', 'session_2');

  assert.equal(splitted.tree.kind, 'branch');
  if (splitted.tree.kind === 'branch') {
    assert.equal(splitted.tree.direction, 'horizontal');
    assert.equal(splitted.tree.fraction, 0.5);
    assert.equal(splitted.tree.first.id, initialLeafId);
    assert.notEqual(splitted.tree.second.id, initialLeafId);
    assert.equal(splitted.tree.second.kind, 'leaf');
    if (splitted.tree.second.kind === 'leaf') {
      assert.equal(splitted.tree.second.sessionId, 'session_2');
    }
  }

  const leaves = collectLeafNodes(splitted.tree);
  assert.equal(leaves.length, 2);
  assert.equal(splitted.focusedPaneId, leaves[1].id);
});

test('closePane 应该关闭窗格并提升同级节点', () => {
  const initial = createInitialLayout('session_1');
  const leaf1Id = initial.tree.id;
  const splitted = splitPane(initial, leaf1Id, 'horizontal', 'session_2');
  const leaves = collectLeafNodes(splitted.tree);
  const leaf2Id = leaves[1].id;

  // 关闭第二个窗格
  const closed = closePane(splitted, leaf2Id);
  assert.equal(closed.tree.kind, 'leaf');
  assert.equal(closed.tree.id, leaf1Id);
  assert.equal(closed.focusedPaneId, leaf1Id);
});

test('computeLayoutGeometry 应该正确计算水平左右平分的几何位置', () => {
  const initial = createInitialLayout('session_1');
  const splitted = splitPane(initial, initial.tree.id, 'horizontal', 'session_2');

  const containerRect = { x: 0, y: 0, width: 1000, height: 600 };
  const geometry = computeLayoutGeometry(splitted, containerRect, 10);

  assert.equal(geometry.panes.length, 2);
  assert.equal(geometry.dividers.length, 1);

  const [pane1, pane2] = geometry.panes;
  const divider = geometry.dividers[0];

  // 1000 - 10 = 990; 990 * 0.5 = 495
  assert.equal(pane1.rect.width, 495);
  assert.equal(pane1.rect.height, 600);
  assert.equal(pane1.rect.x, 0);

  assert.equal(divider.rect.x, 495);
  assert.equal(divider.rect.width, 10);

  assert.equal(pane2.rect.x, 505);
  assert.equal(pane2.rect.width, 495);
});

test('detectDropZone 应该准确识别 Antigravity 2.0 风格的边缘拖拽热区', () => {
  const rect = { x: 0, y: 0, width: 800, height: 600 };

  // 靠近右侧边缘 (x = 750, y = 300)
  const dropRight = detectDropZone(rect, 750, 300, 0.25);
  assert.equal(dropRight.position, 'right');
  assert.deepEqual(dropRight.rect, { x: 400, y: 0, width: 400, height: 600 });

  // 靠近底部边缘 (x = 400, y = 550)
  const dropBottom = detectDropZone(rect, 400, 550, 0.25);
  assert.equal(dropBottom.position, 'bottom');
  assert.deepEqual(dropBottom.rect, { x: 0, y: 300, width: 800, height: 300 });

  // 中心区域
  const dropCenter = detectDropZone(rect, 400, 300, 0.25);
  assert.equal(dropCenter.position, 'center');
});
