import { Action } from 'shared/ReactTypes';

// hooks集合定义，有多种hooks集合
export interface Dispatcher {
	useState: <T>(initialState: () => T | T) => [T, Dispatch<T>];
	useEffect: (callback: () => void | void, deps: any[] | void) => void;
}

// setState定义
export type Dispatch<State> = (action: Action<State>) => void;

// 当前的hooks集合
const currentDispatcher: { current: Dispatcher | null } = {
	current: null
};

export const resolveDispatcher = (): Dispatcher => {
	const dispatcher = currentDispatcher.current;

	if (dispatcher === null) {
		throw new Error('hook只能在函数组件中执行');
	}

	return dispatcher;
};

export default currentDispatcher;
