import { Props, ReactElementType } from 'shared/ReactTypes';
import {
	FiberNode,
	createFiberFromElement,
	createWorkInprogress
} from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';

type ExistingChildren = Map<string | number, FiberNode>;

// 就是diff current 和 新element 后打 flag 标签，后续 commit 时要依据 flag 来操作dom
// 并且生成对应 wip fiberNode.
// 下面针对不同 element 的处理分类较多
function ChildReconciler(shouldTrackEffects: boolean) {
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		// update时：
		const key = element.key;

		while (currentFiber !== null) {
			if (currentFiber.key === key) {
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === element.type) {
						// key, type相同，才复用
						const exiting = useFiber(currentFiber, element.props);
						exiting.return = returnFiber;

						// 多节点更新后变成单节点的情况？妈的要这样来分吗
						deleteRemainingChildren(returnFiber, currentFiber.sibling);
						return exiting; // 返回复用的
					}
					// type不相同，不存在任何复用的可能性，删除所有旧的
					deleteRemainingChildren(returnFiber, currentFiber);
					// deleteChild(returnFiber, currentFiber);
				} else {
					if (__DEV__) {
						console.warn('还未实现的React类型', element);
					}
				}
			} else {
				// key不相同，type相同，删除旧的
				deleteChild(returnFiber, currentFiber);
				currentFiber = currentFiber.sibling;
			}
		}

		// mount或删除时： 根据element创建新fiber
		const fiber = createFiberFromElement(element);
		fiber.return = returnFiber;
		return fiber;
	}

	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		// update时：
		while (currentFiber !== null) {
			if (currentFiber.tag === HostText) {
				const exiting = useFiber(currentFiber, { content }); // 文本节点也有复用一说？直接替换文本不就好了
				exiting.return = returnFiber;
				deleteRemainingChildren(returnFiber, currentFiber.sibling);
				return exiting;
			} else {
				// 如果类型变了，删除旧的，再走下面创建新的
				deleteChild(returnFiber, currentFiber);
				currentFiber = currentFiber.sibling;
			}
		}

		// 根据element创建fiber
		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;
		return fiber;
	}

	// 打上 Placement 标记
	function placeSingleChild(fiber: FiberNode) {
		if (shouldTrackEffects && fiber.alternate === null) {
			// if (shouldTrackEffects) {
			fiber.flags |= Placement;
		}
		return fiber;
	}

	// 打上 ChildDeletion 标记
	function deleteChild(returnFiber: FiberNode, childrenToDelete: FiberNode) {
		if (!shouldTrackEffects) {
			return;
		}
		const deletions = returnFiber.deletions;

		if (deletions === null) {
			returnFiber.deletions = [childrenToDelete];
			returnFiber.flags |= ChildDeletion;
		} else {
			deletions.push(childrenToDelete);
		}
	}

	function deleteRemainingChildren(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null
	) {
		if (!shouldTrackEffects) {
			return;
		}

		let childrenToDelete = currentFirstChild;

		while (childrenToDelete !== null) {
			deleteChild(returnFiber, childrenToDelete);
			childrenToDelete = childrenToDelete.sibling;
		}
	}

	function reconcileChildrenArray(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null,
		newChild: any[]
	) {
		// 最后一个可复用fiber在current中的index
		let lastPlacedIndex = 0;
		// 创建的最后一个fiber
		let lastNewFiber: FiberNode | null = null;
		// 创建的第一个fiber
		let firstNewFiber: FiberNode | null = null;

		// 1.将current保存在map中
		const existingChildren: ExistingChildren = new Map();
		let current = currentFirstChild;

		while (current !== null) {
			const keyToUse = current.key !== null ? current.key : current.index;
			existingChildren.set(keyToUse, current);
			current = current.sibling;
		}

		// Diff算法，和 Vue 的 patchKeyedChildren 类似，看书上的图比较好懂
		// 2.遍历newChild，寻找是否可复用 (就是对比current fiber和最新element，要注意的是前者是链表，后者是数组)
		for (let i = 0; i < newChild.length; i++) {
			const newFiber = updateFromMap(
				returnFiber,
				existingChildren,
				i,
				newChild[i]
			);

			if (newFiber === null) {
				continue;
			}

			// 3. 标记移动还是插入
			newFiber.index = 1;
			newFiber.return = returnFiber;

			if (lastNewFiber === null) {
				lastNewFiber = newFiber;
				firstNewFiber = newFiber;
			} else {
				lastNewFiber.sibling = newFiber;
				lastNewFiber = lastNewFiber.sibling;
			}

			if (!shouldTrackEffects) {
				continue;
			}

			const current = newFiber.alternate;
			if (current !== null) {
				const oldIndex = current.index;
				if (oldIndex < lastPlacedIndex) {
					// 移动
					newFiber.flags |= Placement;
					continue;
				} else {
					// 不移动
					lastPlacedIndex = oldIndex;
				}
			} else {
				// mount
				newFiber.flags |= Placement;
			}
		}

		// 4. 将Map中剩下的标记为删除
		existingChildren.forEach((fiber) => {
			deleteChild(returnFiber, fiber);
		});

		return firstNewFiber;
	}

	function updateFromMap(
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number,
		element: any
	): FiberNode | null {
		const keyToUse = element.key !== null ? element.key : element.index;
		const before = existingChildren.get(keyToUse);

		// HostText
		if (typeof element === 'string' || typeof element === 'number') {
			if (before) {
				if (before) {
					if (before.tag === HostText) {
						existingChildren.delete(keyToUse);
						return useFiber(before, { content: element + '' });
					}
				}
				return new FiberNode(HostText, { content: element + '' }, null);
			}
		}

		// ReactElement
		if (typeof element === 'object' && element !== null) {
			switch (element.$$typeof) {
				case REACT_ELEMENT_TYPE:
					if (before) {
						if (before.type === element.type) {
							existingChildren.delete(keyToUse);
							return useFiber(before, element.props);
						}
					}
					return createFiberFromElement(element);
			}

			// TODO 数组类型，孙子节点也是数组
			if (Array.isArray(element) && __DEV__) {
				console.warn('还未实现数组类型的child');
			}
		}
		return null;
	}

	// 入口函数
	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild: any
	) {
		// HostComponent
		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						reconcileSingleElement(returnFiber, currentFiber, newChild)
					);
				default:
					if (__DEV__) {
						console.warn('未实现的reconcile类型', newChild);
					}
					break;
			}
			// 多节点情况，ul -> li*3
			// 为什么这样单节点多节点这样分，统一转成数组不好吗
			if (Array.isArray(newChild)) {
				return reconcileChildrenArray(returnFiber, currentFiber, newChild);
			}
		}

		// HostText
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			);
		}

		// 兜底
		if (currentFiber !== null) {
			deleteChild(returnFiber, currentFiber);
		}

		if (__DEV__) {
			console.warn('未实现的reconcile类型', newChild);
		}

		return null;
	};
}

// 复用fiber，createWorkInprogress其实就是复用其alternate
function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
	const clone = createWorkInprogress(fiber, pendingProps);
	clone.index = 0;
	clone.sibling = null;
	return clone;
}

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false); // 对于mount时的优化，可以一次Placement，不用diff
