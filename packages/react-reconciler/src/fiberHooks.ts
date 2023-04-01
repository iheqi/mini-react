import internals from 'shared/internal';
import { FiberNode } from './fiber';

const { currentDispatcher } = internals;

// Hook数据结构定义
interface Hook {
	// 这里要注意 fiberNode 上也有一个 memorizedState 字段是保存fiber相关状态的
	// 而这个是保存hook数据的
	memorizedState: any;
	updateQueue: unknown; // setState更新时使用
	next: Hook | null; // 链表指针
}

// hook自身数据保存在当前 fiberNode
let currentlyRenderingFiber: FiberNode | null = null;

const workInProgressHook: Hook | null = null;

export function renderWithHooks(wip: FiberNode) {
	// 赋值操作
	currentlyRenderingFiber = wip;
	wip.memoizedState = null; // 初始化，收集hook

	// 根据 wip.alternate 判断在何种状态
	// 操作数据共享层，确定Hooks集合
	const current = wip.alternate;

	if (current !== null) {
	} else {
		// mount
		currentDispatcher.current = {};
	}

	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);

	// 重置操作
	currentlyRenderingFiber = null;
	return children;
}
