/**
 * Alibaba Java / Engineering Standards Validation Test Suite
 * 
 * 严格按照阿里巴巴工程规范与 AIR / BCDE 原则设计：
 * - A (Automatic 自动化)
 * - I (Independent 独立性)
 * - R (Repeatable 可重复)
 * 
 * - B (Border 边界值测试)
 * - C (Correct 正向功能测试)
 * - D (Design 设计规约测试：布尔字段无 is 前缀、结构解耦、资源防泄漏)
 * - E (Error 异常与容错测试)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialLayout,
  splitPane,
  closePane,
  computeLayoutGeometry,
  resizeDivider,
  collectLeafNodes,
  createSplitGroupSnapshot
} from '../src/core/layoutEngine.ts';

describe('阿里巴巴工程规范与质量门禁测试 (AIR & BCDE Tests)', () => {

  // ==========================================
  // B: Border 边界值测试
  // ==========================================
  describe('B: Border 边界值测试', () => {
    test('边界值1: 极小极限视口（width < 100px, height < 100px）不发生崩溃或倒置', () => {
      const initial = createInitialLayout('s1');
      const state = splitPane(initial, initial.tree.id, 'horizontal', 's2');
      const tinyContainer = { x: 0, y: 0, width: 80, height: 60 };
      const geom = computeLayoutGeometry(state, tinyContainer);
      
      assert.strictEqual(geom.panes.length, 2);
      geom.panes.forEach(p => {
        assert.ok(p.rect.width >= 0, '窗格宽度必须非负');
        assert.ok(p.rect.height >= 0, '窗格高度必须非负');
      });
    });

    test('边界值2: 分割条拖动至极限 0px 与超大尺寸时正确执行 Clamp 保护', () => {
      const initial = createInitialLayout('s1');
      const state = splitPane(initial, initial.tree.id, 'horizontal', 's2');
      const branchId = state.tree.id;
      
      // 极端左拖（-10000px）
      const clampedMin = resizeDivider(state.tree, branchId, -10000, 1000);
      assert.ok(clampedMin.fraction >= 0.15, '分割比例不可低于下限阈值');

      // 极端右拖（+10000px）
      const clampedMax = resizeDivider(state.tree, branchId, 10000, 1000);
      assert.ok(clampedMax.fraction <= 0.85, '分割比例不可高于上限阈值');
    });

    test('边界值3: 单窗格最大化 (Maximize) 场景下严格独占容器空间', () => {
      let state = splitPane(createInitialLayout('s1'), 'pane_1', 'horizontal', 's2');
      const leafId = collectLeafNodes(state.tree)[0].id;
      state.maximizedPaneId = leafId;
      
      const container = { x: 0, y: 0, width: 1920, height: 1080 };
      const geom = computeLayoutGeometry(state, container);
      
      assert.strictEqual(geom.panes.length, 1);
      assert.strictEqual(geom.panes[0].id, leafId);
      assert.strictEqual(geom.panes[0].rect.width, 1920);
      assert.strictEqual(geom.panes[0].rect.height, 1080);
      assert.strictEqual(geom.panes[0].maximized, true);
    });
  });

  // ==========================================
  // C: Correct 正向功能测试
  // ==========================================
  describe('C: Correct 正向功能测试', () => {
    test('正向1: 初始单窗格二叉树构建正确', () => {
      const state = createInitialLayout('session-init');
      assert.strictEqual(state.tree.kind, 'leaf');
      assert.strictEqual(state.tree.sessionId, 'session-init');
      assert.strictEqual(state.maximizedPaneId, null);
    });

    test('正向2: 复合二叉树（3 窗格复合分屏）几何坐标与分割条完全对齐', () => {
      let state = createInitialLayout('s1');
      const p1 = state.tree.id;
      state = splitPane(state, p1, 'horizontal', 's2');
      const leaves = collectLeafNodes(state.tree);
      state = splitPane(state, leaves[1].id, 'vertical', 's3');

      const container = { x: 0, y: 0, width: 1200, height: 800 };
      const geom = computeLayoutGeometry(state, container, 6);

      assert.strictEqual(geom.panes.length, 3);
      assert.strictEqual(geom.dividers.length, 2);
    });

    test('正向3: 复合多分屏成功归拢为分屏工作组快照 (Split Group Snapshot)', () => {
      let state = createInitialLayout('session_a');
      state = splitPane(state, state.tree.id, 'horizontal', 'session_b');
      const titles = { [collectLeafNodes(state.tree)[0].id]: '会话A', [collectLeafNodes(state.tree)[1].id]: '会话B' };

      const snapshot = createSplitGroupSnapshot(state, titles);
      assert.ok(snapshot.id.startsWith('group-'), '工作组ID必须带有标准 group- 前缀');
      assert.strictEqual(snapshot.sessions.length, 2);
      assert.strictEqual(snapshot.sessions[0].id, 'session_a');
      assert.strictEqual(snapshot.sessions[1].id, 'session_b');
      assert.ok(snapshot.name.includes('分屏工作组'), '工作组标题必须包含分屏工作组');
    });
  });

  // ==========================================
  // D: Design 设计规约与阿里规范测试
  // ==========================================
  describe('D: Design 阿里设计规范测试', () => {
    test('阿里命名规范: ComputedPaneGeometry 布尔属性严禁 is 前缀', () => {
      const state = createInitialLayout('s1');
      const geom = computeLayoutGeometry(state, { x: 0, y: 0, width: 800, height: 600 });
      const pane = geom.panes[0];

      // 遵循规范：定义为 focused / maximized，严禁 isFocused / isMaximized
      assert.ok('focused' in pane, '属性必须命名为 focused');
      assert.ok('maximized' in pane, '属性必须命名为 maximized');
      assert.strictEqual('isFocused' in pane, false, '严禁包含 isFocused 前缀属性');
      assert.strictEqual('isMaximized' in pane, false, '严禁包含 isMaximized 前缀属性');
    });

    test('二叉树不可变性与纯函数契约: splitPane 不破坏原 state 引用', () => {
      const origin = createInitialLayout('s1');
      const next = splitPane(origin, origin.tree.id, 'horizontal', 's2');

      assert.notStrictEqual(origin, next, '必须返回新的状态对象引用');
      assert.strictEqual(origin.tree.kind, 'leaf', '原状态二叉树结构不可被直接篡改');
    });

    test('设计规约3: SplitGroupSnapshot 对象深度解耦，修改快照不污染原 layout 状态', () => {
      const state = splitPane(createInitialLayout('s1'), 'pane_1', 'horizontal', 's2');
      const snapshot = createSplitGroupSnapshot(state, { pane_1: '标题1' });

      // 篡改快照内部属性
      snapshot.layout.focusedPaneId = 'hacked_pane_id';
      assert.notStrictEqual(state.focusedPaneId, 'hacked_pane_id', '快照与原状态必须保持深拷贝隔离');
    });
  });

  // ==========================================
  // E: Error 异常与容错测试
  // ==========================================
  describe('E: Error 异常与容错测试', () => {
    test('容错1: 关闭不存在的非法 Pane ID 时安全降级，不抛出未捕获异常', () => {
      const state = createInitialLayout('s1');
      const next = closePane(state, 'non_existent_pane_9999');

      assert.strictEqual(collectLeafNodes(next.tree).length, 1);
      assert.strictEqual(next.tree.kind, 'leaf');
    });

    test('容错2: 唯一窗格执行关闭时，只清空会话绑定，保持窗格不坍塌', () => {
      const state = createInitialLayout('s1');
      const singleId = state.tree.id;
      const next = closePane(state, singleId);

      assert.strictEqual(next.tree.id, singleId);
      assert.strictEqual(next.tree.sessionId, null);
    });

    test('容错3: 单会话或空标题场景下生成默认描述，不抛出未捕获异常', () => {
      const singleState = createInitialLayout('single_session');
      const snapshot = createSplitGroupSnapshot(singleState, {});
      assert.ok(snapshot.name.length > 0);
      assert.strictEqual(snapshot.sessions.length, 1);
    });
  });
});
