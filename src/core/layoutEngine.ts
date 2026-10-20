/**
 * dshd-split-view 核心布局引擎
 * 
 * 逆向自 Antigravity 2.0 窗格拆分调度核心算法：
 * 1. 二叉分屏树递归几何计算 (Binary Tree Layout Resolution)
 * 2. 窗格拆分、关闭与重平衡 (Splitting, Closing & Tree Balancing)
 * 3. 分割条比例调节与边界约束 (Divider Dragging & Range Clamping)
 * 4. 边缘拖拽热区检测与高亮占位计算 (Antigravity DropZone Detection)
 * 
 * @author Locke (locke-w)
 */

import type {
  SplitNode,
  LeafNode,
  BranchNode,
  LayoutState,
  Rect,
  LayoutGeometry,
  ComputedPaneGeometry,
  ComputedDividerGeometry,
  SplitDirection,
  DropZoneInfo,
  DropPosition
} from './types.ts';

export const DEFAULT_DIVIDER_SIZE = 5;
export const MIN_PANE_SIZE = 180; // 最小窗格尺寸 (px)，防止过度压缩
export const EDGE_DROP_ZONE_RATIO = 0.25; // 边缘触发分屏放置的阈值比例

let idCounter = 0;
export function generateUniqueId(prefix = 'pane'): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}_${idCounter}`;
}

/**
 * 创建初始单窗格布局
 */
export function createInitialLayout(initialSessionId: string | null = null): LayoutState {
  const initialPaneId = generateUniqueId('pane');
  return {
    tree: {
      kind: 'leaf',
      id: initialPaneId,
      sessionId: initialSessionId
    },
    focusedPaneId: initialPaneId,
    maximizedPaneId: null
  };
}

/**
 * 递归收集所有叶子节点
 */
export function collectLeafNodes(node: SplitNode, result: LeafNode[] = []): LeafNode[] {
  if (node.kind === 'leaf') {
    result.push(node);
  } else {
    collectLeafNodes(node.first, result);
    collectLeafNodes(node.second, result);
  }
  return result;
}

/**
 * 查找指定 ID 的节点及其父节点
 */
export function findNodeWithParent(
  root: SplitNode,
  targetId: string,
  parent: BranchNode | null = null
): { node: SplitNode; parent: BranchNode | null } | null {
  if (root.id === targetId) {
    return { node: root, parent };
  }
  if (root.kind === 'branch') {
    const inFirst = findNodeWithParent(root.first, targetId, root);
    if (inFirst) return inFirst;
    return findNodeWithParent(root.second, targetId, root);
  }
  return null;
}

/**
 * 拆分指定窗格 (向右或向下)
 * 遵循 Antigravity 2.0 逻辑：原窗格与新窗格平分当前空间 (fraction 默认 0.5)
 */
export function splitPane(
  state: LayoutState,
  targetPaneId: string,
  direction: SplitDirection,
  newSessionId: string | null = null
): LayoutState {
  const newPaneId = generateUniqueId('pane');
  const newLeaf: LeafNode = {
    kind: 'leaf',
    id: newPaneId,
    sessionId: newSessionId
  };

  function replaceNode(node: SplitNode): SplitNode {
    if (node.kind === 'leaf' && node.id === targetPaneId) {
      const branch: BranchNode = {
        kind: 'branch',
        id: generateUniqueId('branch'),
        direction,
        fraction: 0.5,
        first: node,
        second: newLeaf
      };
      return branch;
    }
    if (node.kind === 'branch') {
      return {
        ...node,
        first: replaceNode(node.first),
        second: replaceNode(node.second)
      };
    }
    return node;
  }

  const newTree = replaceNode(state.tree);
  return {
    ...state,
    tree: newTree,
    focusedPaneId: newPaneId,
    maximizedPaneId: null // 分屏时取消最大化
  };
}

/**
 * 关闭指定窗格
 * 如果是最后一个窗格，则保留重置为空窗格；否则其同级兄弟节点提升替代父分支
 */
export function closePane(state: LayoutState, targetPaneId: string): LayoutState {
  const leaves = collectLeafNodes(state.tree);
  if (leaves.length <= 1) {
    // 只有一个窗格时，只清空会话绑定，不移除窗格
    const singleLeaf = leaves[0];
    return {
      tree: {
        kind: 'leaf',
        id: singleLeaf.id,
        sessionId: null
      },
      focusedPaneId: singleLeaf.id,
      maximizedPaneId: null
    };
  }

  function pruneNode(node: SplitNode): SplitNode | null {
    if (node.kind === 'leaf') {
      return node.id === targetPaneId ? null : node;
    }
    const nextFirst = pruneNode(node.first);
    const nextSecond = pruneNode(node.second);

    if (nextFirst === null) return nextSecond;
    if (nextSecond === null) return nextFirst;

    return {
      ...node,
      first: nextFirst,
      second: nextSecond
    };
  }

  const updatedTree = pruneNode(state.tree) || state.tree;
  const remainingLeaves = collectLeafNodes(updatedTree);
  let nextFocusedId = state.focusedPaneId;

  if (nextFocusedId === targetPaneId) {
    nextFocusedId = remainingLeaves[0]?.id || '';
  }

  return {
    tree: updatedTree,
    focusedPaneId: nextFocusedId,
    maximizedPaneId: state.maximizedPaneId === targetPaneId ? null : state.maximizedPaneId
  };
}

/**
 * 拖动分割条调整比例
 */
export function resizeDivider(
  tree: SplitNode,
  branchId: string,
  deltaPx: number,
  totalAvailablePx: number
): SplitNode {
  function update(node: SplitNode): SplitNode {
    if (node.kind === 'branch') {
      if (node.id === branchId) {
        if (totalAvailablePx <= 0) return node;
        const deltaFraction = deltaPx / totalAvailablePx;
        let newFraction = node.fraction + deltaFraction;
        
        // 最小尺寸约束
        const minRatio = MIN_PANE_SIZE / totalAvailablePx;
        newFraction = Math.max(minRatio, Math.min(1 - minRatio, newFraction));
        return {
          ...node,
          fraction: newFraction
        };
      }
      return {
        ...node,
        first: update(node.first),
        second: update(node.second)
      };
    }
    return node;
  }

  return update(tree);
}

/**
 * 递归计算全树所有 Pane 与 Divider 的几何坐标
 */
export function computeLayoutGeometry(
  state: LayoutState,
  containerRect: Rect,
  dividerSize = DEFAULT_DIVIDER_SIZE
): LayoutGeometry {
  const panes: ComputedPaneGeometry[] = [];
  const dividers: ComputedDividerGeometry[] = [];

  // 如果处于单窗格最大化状态
  if (state.maximizedPaneId) {
    const target = collectLeafNodes(state.tree).find(p => p.id === state.maximizedPaneId);
    if (target) {
      panes.push({
        id: target.id,
        sessionId: target.sessionId,
        rect: { ...containerRect },
        focused: true,
        maximized: true
      });
      return { panes, dividers };
    }
  }

  function layoutRecursive(node: SplitNode, currentRect: Rect) {
    if (node.kind === 'leaf') {
      panes.push({
        id: node.id,
        sessionId: node.sessionId,
        rect: { ...currentRect },
        focused: node.id === state.focusedPaneId,
        maximized: false
      });
      return;
    }

    const { direction, fraction, first, second, id } = node;
    const isHorizontal = direction === 'horizontal';

    if (isHorizontal) {
      const availableWidth = Math.max(0, currentRect.width - dividerSize);
      const firstWidth = Math.round(availableWidth * fraction);
      const secondWidth = Math.max(0, availableWidth - firstWidth);

      const firstRect: Rect = {
        x: currentRect.x,
        y: currentRect.y,
        width: firstWidth,
        height: currentRect.height
      };

      const dividerRect: Rect = {
        x: currentRect.x + firstWidth,
        y: currentRect.y,
        width: dividerSize,
        height: currentRect.height
      };

      const secondRect: Rect = {
        x: currentRect.x + firstWidth + dividerSize,
        y: currentRect.y,
        width: secondWidth,
        height: currentRect.height
      };

      dividers.push({
        id: `divider_${id}`,
        branchId: id,
        direction,
        rect: dividerRect
      });

      layoutRecursive(first, firstRect);
      layoutRecursive(second, secondRect);
    } else {
      // 垂直分屏 (上下)
      const availableHeight = Math.max(0, currentRect.height - dividerSize);
      const firstHeight = Math.round(availableHeight * fraction);
      const secondHeight = Math.max(0, availableHeight - firstHeight);

      const firstRect: Rect = {
        x: currentRect.x,
        y: currentRect.y,
        width: currentRect.width,
        height: firstHeight
      };

      const dividerRect: Rect = {
        x: currentRect.x,
        y: currentRect.y + firstHeight,
        width: currentRect.width,
        height: dividerSize
      };

      const secondRect: Rect = {
        x: currentRect.x,
        y: currentRect.y + firstHeight + dividerSize,
        width: currentRect.width,
        height: secondHeight
      };

      dividers.push({
        id: `divider_${id}`,
        branchId: id,
        direction,
        rect: dividerRect
      });

      layoutRecursive(first, firstRect);
      layoutRecursive(second, secondRect);
    }
  }

  layoutRecursive(state.tree, containerRect);
  return { panes, dividers };
}

/**
 * Antigravity 2.0 拖拽分屏热区识别 (Drop Zone Detection)
 * 当鼠标将一个会话拖入某个 Pane 区域时，检测鼠标是否位于四周边缘，
 * 并返回高亮指示遮罩（Ghost Overlay）的矩形区域。
 */
export function detectDropZone(
  paneRect: Rect,
  clientX: number,
  clientY: number,
  ratio = EDGE_DROP_ZONE_RATIO
): DropZoneInfo {
  const relX = clientX - paneRect.x;
  const relY = clientY - paneRect.y;

  // 越界检查
  if (relX < 0 || relX > paneRect.width || relY < 0 || relY > paneRect.height) {
    return { position: 'none', rect: null };
  }

  const thresholdW = paneRect.width * ratio;
  const thresholdH = paneRect.height * ratio;

  // 判定靠近哪一条边
  const distLeft = relX;
  const distRight = paneRect.width - relX;
  const distTop = relY;
  const distBottom = paneRect.height - relY;

  const minDist = Math.min(distLeft, distRight, distTop, distBottom);

  if (minDist === distLeft && distLeft <= thresholdW) {
    return {
      position: 'left',
      rect: {
        x: paneRect.x,
        y: paneRect.y,
        width: paneRect.width / 2,
        height: paneRect.height
      }
    };
  }

  if (minDist === distRight && distRight <= thresholdW) {
    return {
      position: 'right',
      rect: {
        x: paneRect.x + paneRect.width / 2,
        y: paneRect.y,
        width: paneRect.width / 2,
        height: paneRect.height
      }
    };
  }

  if (minDist === distTop && distTop <= thresholdH) {
    return {
      position: 'top',
      rect: {
        x: paneRect.x,
        y: paneRect.y,
        width: paneRect.width,
        height: paneRect.height / 2
      }
    };
  }

  if (minDist === distBottom && distBottom <= thresholdH) {
    return {
      position: 'bottom',
      rect: {
        x: paneRect.x,
        y: paneRect.y + paneRect.height / 2,
        width: paneRect.width,
        height: paneRect.height / 2
      }
    };
  }

  // 内部中心区域：全量覆盖
  return {
    position: 'center',
    rect: { ...paneRect }
  };
}
