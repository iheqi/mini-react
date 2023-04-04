import {
	Container,
	appendChildToContainer,
	commitUpdate,
	removeChild
} from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import {
	ChildDeletion,
	MutationMask,
	NoFlags,
	Placement,
	Update
} from './fiberFlags';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';

let nextEffect: FiberNode | null = null;

// commit - mutation 阶段
export const commitMutationEffects = (finishedWork: FiberNode) => {
	nextEffect = finishedWork;

	// 搓比玩意又整一遍 Fiber树 的 DFS
	while (nextEffect !== null) {
		// 向下遍历
		const child: FiberNode | null = nextEffect.child;
		if (
			(nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
			child !== null
		) {
			nextEffect = child;
		} else {
			// 向上遍历
			up: while (nextEffect !== null) {
				commitMutationEffectsOnFiber(nextEffect);
				const sibling: FiberNode | null = nextEffect.sibling;

				if (sibling !== null) {
					nextEffect = sibling;
					break up;
				}
				nextEffect = nextEffect.return;
			}
		}
	}
};

function commitMutationEffectsOnFiber(finishedWork: FiberNode) {
	const flags = finishedWork.flags;
	if ((flags & Placement) !== NoFlags) {
		// 插入/移动
		commitPlacement(finishedWork);
		finishedWork.flags &= ~Placement; // 完成后清除 Placement 标记
	}

	if ((flags & Update) !== NoFlags) {
		// 更新
		commitUpdate(finishedWork);
		finishedWork.flags &= ~Update;
	}

	if ((flags & ChildDeletion) !== NoFlags) {
		// 删除

		const deletions = finishedWork.deletions;

		if (deletions !== null) {
			deletions.forEach((childToDelete) => {
				commitDeletion(childToDelete);
			});
		}
		commitUpdate(finishedWork);
		finishedWork.flags &= ~ChildDeletion;
	}
}

// 以下代码开始真正操作DOM树
function commitPlacement(finishedWork: FiberNode) {
	if (__DEV__) {
		console.log('执行Placement操作', finishedWork);
	}

	// parent DOM
	const hostParent = getHostParent(finishedWork);
	if (hostParent !== null) {
		appendPlacementNodeIntoContainer(finishedWork, hostParent);
	}
}

// 对于标记ChildDeletion的子树，由于子树中:
// * 对于FC，需要处理useEffect unmount执行、解绑ref
// * 对于HostComponent，需要解绑ref
// * 对于子树的「根HostComponent」，需要移除DOM

// 所以需要实现「遍历ChildDeletion子树」的流程

// <div>
// 	<App/>
// 	<p>
// </div>

// function App() {
// 	return <span>123</span>
// }

function commitDeletion(childToDelete: FiberNode) {
	let rootHostNode: FiberNode | null = null;

	commitNestedComponent(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent: // 对于HostComponent，需要解绑ref
				if (rootHostNode === null) {
					// wtf???
					rootHostNode = unmountFiber;
				}
				break;
			case HostText:
				if (rootHostNode === null) {
					// wtf???
					rootHostNode = unmountFiber;
				}
				break;
			case FunctionComponent:
				break;
			default:
				if (__DEV__) {
					console.warn('未处理的unmount类型', unmountFiber);
				}
				break;
		}
	});

	// 搞不懂，为什么不是直接删除 childToDelete
	if (rootHostNode !== null) {
		const hostParent = getHostParent(childToDelete);
		if (hostParent !== null) {
			removeChild((rootHostNode as FiberNode).stateNode, hostParent);
		}
	}

	childToDelete.return = null;
	childToDelete.child = null;
}

function commitNestedComponent(
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) {
	let node = root;
	while (true) {
		onCommitUnmount(node);
		// 向下遍历

		if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}
		// 终止条件，从下到上完了

		if (node === root) {
			return;
		}

		// 向上递归
		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return;
			}
			node = node.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

function getHostParent(fiber: FiberNode): Container | null {
	let parent = fiber.return;

	while (parent) {
		const parentTag = parent.tag;
		if (parentTag === HostComponent) {
			return parent.stateNode as Container;
		}
		if (parentTag === HostRoot) {
			return (parent.stateNode as FiberRootNode).container;
		}
		parent = parent.return;
	}
	console.error('getHostParent未找到hostParent');
	return null;
}

function appendPlacementNodeIntoContainer(
	finishedWork: FiberNode,
	hostParent: Container
) {
	if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
		appendChildToContainer(hostParent, finishedWork.stateNode);
		return;
	}

	const child = finishedWork.child;

	if (child !== null) {
		appendPlacementNodeIntoContainer(child, hostParent);
		let sibling = child.sibling;
		while (sibling !== null) {
			appendPlacementNodeIntoContainer(sibling, hostParent);
			sibling = sibling.sibling;
		}
	}
}
