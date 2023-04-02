import { Props, ReactElementType } from 'shared/ReactTypes';
import {
	FiberNode,
	createFiberFromElement,
	createWorkInprogress
} from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';

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

		if (currentFiber !== null) {
			if (currentFiber.key === key) {
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === element.type) {
						// key, type相同，才复用
						const exiting = useFiber(currentFiber, element.props);
						exiting.return = returnFiber;
						return exiting; // 返回复用的
					}
					// type不相同，删除旧的
					deleteChild(returnFiber, currentFiber);
				} else {
					if (__DEV__) {
						console.warn('还未实现的React类型', element);
					}
				}
			} else {
				// key不相同，删除旧的
				deleteChild(returnFiber, currentFiber);
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

		if (currentFiber !== null) {
			if (currentFiber.tag === HostText) {
				const exiting = useFiber(currentFiber, { content }); // 文本节点也有复用一说？直接替换文本不就好了
				exiting.return = returnFiber;
				return exiting;
			} else {
				// 如果类型变了，删除旧的，再走下面创建新的
				deleteChild(returnFiber, currentFiber);
			}
		}

		// 根据element创建fiber
		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;
		return fiber;
	}

	// 打上 Placement 标记
	function placeSingleChild(fiber: FiberNode) {
		// 10.3 遗留问题1：没有收集到flag
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
		}

		// HostText
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			debugger;
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
