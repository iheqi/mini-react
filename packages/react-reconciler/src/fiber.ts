// packages/react-reconciler/src/ReactFiber.new.js

import { Props, Key, Ref, ReactElementType } from 'shared/ReactTypes';
import { FunctionComponent, HostComponent, WorkTag } from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';

export class FiberNode {
	type: any;
	tag: WorkTag;
	pendingProps: Props;
	key: Key;
	stateNode: any;
	ref: Ref;

	return: FiberNode | null;
	sibling: FiberNode | null;
	child: FiberNode | null;
	index: number;

	memoizedProps: Props | null;
	memoizedState: any;
	alternate: FiberNode | null; // 双缓存树对应指针
	flags: Flags;
	subtreeFlags: Flags;

	updateQueue: unknown;

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		this.tag = tag;
		this.key = key;
		this.stateNode = null; // dom
		this.type = null;

		// 构成树状结构
		this.return = null;
		this.sibling = null;
		this.child = null;
		this.index = 0;

		this.ref = null;

		// 作为工作单元
		this.pendingProps = pendingProps; // 初始化时
		this.memoizedProps = null; // 工作完后的状态
		this.memoizedState = null;
		this.updateQueue = null;

		this.alternate = null;

		// 打标签，用在后续commit（也叫副作用）
		this.flags = NoFlags;
		this.subtreeFlags = NoFlags;
	}
}

// const root = ReactDOM.createRoot(document.getElementById('root'));
// root.render(<App />);

// 看图理解指针指向: https://xiaochen1024.com/courseware/60b1b2f6cf10a4003b634718/60b1b340cf10a4003b63471f
// FiberRoot <--> HostRootFiber <--> App
export class FiberRootNode {
	container: Container; // 挂载节点。即 document.getElementById('root')
	current: FiberNode; // hostRootFiber。即 <App />
	finishedWork: FiberNode | null; // 更新完成的 hostRootFiber

	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		hostRootFiber.stateNode = this;
		this.finishedWork = null;
	}
}

// 双缓存树：current Fiber 与 workInProgress Fiber
export const createWorkInprogress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let wip = current.alternate;

	if (wip === null) {
		// 首次渲染
		// mount
		// 看图比较好理解：https://xiaochen1024.com/courseware/60b1b2f6cf10a4003b634718/60b1b340cf10a4003b63471f
		wip = new FiberNode(current.tag, pendingProps, current.key);
		wip.stateNode = current.stateNode;
		wip.alternate = current;
		current.alternate = wip;
	} else {
		// 更新
		wip.pendingProps = pendingProps;
		wip.flags = NoFlags;
		wip.subtreeFlags = NoFlags;
	}
	wip.type = current.type;
	wip.updateQueue = current.updateQueue;

	wip.child = current.child;
	wip.memoizedProps = current.pendingProps;
	wip.memoizedState = current.memoizedState;
	return wip;
};

export function createFiberFromElement(element: ReactElementType) {
	const { type, key, props } = element;
	let fiberTag: WorkTag = FunctionComponent;

	if (typeof type === 'string') {
		fiberTag = HostComponent;
	} else if (typeof type !== 'function') {
		console.error('未定义的type类型', element);
	}

	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = type;

	return fiber;
}
