/**
 * dshd-split-view 布局算法单元测试
 * 
 * 验证 Antigravity 2.0 分屏树算法的鲁棒性：
 * 1. 初始单窗格状态
 * 2. 水平与垂直分屏
 * 3. 多窗格任意二叉树嵌套（3窗格与 4窗格 2x2 田字格）
 * 4. 窗格关闭与兄弟节点自动重平衡
 * 5. 几何坐标与分割条计算
 * 6. 边缘拖拽热区判定
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

test('3窗格分屏：先向右拆分，再对右侧窗格向下拆分', () => {
  const initial = createInitialLayout('s1');
  const p1 = initial.tree.id;

  // 1. 向右分屏
  const step1 = splitPane(initial, p1, 'horizontal', 's2');
  const leaves1 = collectLeafNodes(step1.tree);
  assert.equal(leaves1.length, 2);
  const p2 = leaves1[1].id;

  // 2. 对 p2 向下分屏
  const step2 = splitPane(step1, p2, 'vertical', 's3');
  const leaves2 = collectLeafNodes(step2.tree);
  assert.equal(leaves2.length, 3);
  const p3 = leaves2[2].id;

  // 3. 计算 1000 x 600 排版
  const container = { x: 0, y: 0, width: 1000, height: 600 };
  const geo = computeLayoutGeometry(step2, container, 10);

  assert.equal(geo.panes.length, 3);
  assert.equal(geo.dividers.length, 2);

  // p1 占左侧全高
  const pane1 = geo.panes.find(p => p.id === p1);
  assert.equal(pane1.rect.x, 0);
  assert.equal(pane1.rect.y, 0);
  assert.equal(pane1.rect.width, 495);
  assert.equal(pane1.rect.height, 600);

  // p2 占右上
  const pane2 = geo.panes.find(p => p.id === p2);
  assert.equal(pane2.rect.x, 505);
  assert.equal(pane2.rect.y, 0);
  assert.equal(pane2.rect.width, 495);
  assert.equal(pane2.rect.height, 295);

  // p3 占右下
  const pane3 = geo.panes.find(p => p.id === p3);
  assert.equal(pane3.rect.x, 505);
  assert.equal(pane3.rect.y, 305);
  assert.equal(pane3.rect.width, 495);
  assert.equal(pane3.rect.height, 295);
});

test('4窗格分屏：2x2 田字格分屏', () => {
  const initial = createInitialLayout('s1');
  const p1 = initial.tree.id;

  // 1. 向右分屏
  const step1 = splitPane(initial, p1, 'horizontal', 's2');
  const leaves1 = collectLeafNodes(step1.tree);
  const p2 = leaves1[1].id;

  // 2. 对 p1 向下分屏
  const step2 = splitPane(step1, p1, 'vertical', 's3');

  // 3. 对 p2 向下分屏
  const step3 = splitPane(step2, p2, 'vertical', 's4');
  const leaves3 = collectLeafNodes(step3.tree);
  assert.equal(leaves3.length, 4);

  // 4. 计算 1000 x 600 排版
  const container = { x: 0, y: 0, width: 1000, height: 600 };
  const geo = computeLayoutGeometry(step3, container, 10);

  assert.equal(geo.panes.length, 4);
  assert.equal(geo.dividers.length, 3); // 1 主垂直分割 + 2 水平子分割

  for (const pane of geo.panes) {
    assert.equal(pane.rect.width, 495);
    assert.equal(pane.rect.height, 295);
  }
});

test('detectDropZone 应该准确识别 Antigravity 2.0 风格的边缘拖拽热区', () => {
  const rect = { x: 0, y: 0, width: 800, height: 600 };

  // 靠近右侧边缘
  const dropRight = detectDropZone(rect, 750, 300, 0.25);
  assert.equal(dropRight.position, 'right');
  assert.deepEqual(dropRight.rect, { x: 400, y: 0, width: 400, height: 600 });

  // 靠近底部边缘
  const dropBottom = detectDropZone(rect, 400, 550, 0.25);
  assert.equal(dropBottom.position, 'bottom');
  assert.deepEqual(dropBottom.rect, { x: 0, y: 300, width: 800, height: 300 });

  // 中心区域
  const dropCenter = detectDropZone(rect, 400, 300, 0.25);
  assert.equal(dropCenter.position, 'center');
});
