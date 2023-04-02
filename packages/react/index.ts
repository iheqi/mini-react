import currentDispatcher, {
	Dispatcher,
	resolveDispatcher
} from './src/currentDispatcher';
import { jsx, jsxDEV, isValidElement as isValidElementFn } from './src/jsx';

// 暴露接口
export const useState: Dispatcher['useState'] = (initialState: any) => {
	const dispatcher = resolveDispatcher();
	return dispatcher.useState(initialState);
};

// 内部数据共享层
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
	currentDispatcher
};

export const version = '0.0.1';

export const createElement = jsx;

export const isValidElement = isValidElementFn;

export default {
	version: '0.0.1',
	createElement: jsxDEV
};
