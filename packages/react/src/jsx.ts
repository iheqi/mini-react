import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import {
	Type,
	Key,
	Ref,
	Props,
	ReactElementType,
	ElementType
} from 'shared/ReactTypes';

const ReactElement = function (
	type: Type,
	key: Key,
	ref: Ref,
	props: Props
): ReactElementType {
	const element = {
		$$typeof: REACT_ELEMENT_TYPE,
		type,
		key,
		ref,
		props,
		__mark: 'GAGA'
	};

	return element;
};

// 使用方式：
// import {jsx as _jsx} from 'react/jsx-runtime';

// function App() {
//   return _jsx('h1', { children: 'Hello world' });
// }

// maybeChildren参数示例：
// const a = 1;
// const element = React.createElement(
// 	ComponentFC,
// 	{
// 		children: 'text'
// 	},
// 	a
// );
// expect(element.props.children).toBe(a);

export const jsx = (type: ElementType, config: any, ...maybeChildren: any) => {
	const props: Props = {};
	let key: Key = null; // 保存key、ref这两个特殊对象
	let ref: Ref = null;

	for (const prop in config) {
		const val = config[prop];
		if (prop === 'key') {
			if (val !== undefined) {
				key = '' + val;
			}
			continue;
		}
		if (prop === 'ref') {
			if (val !== undefined) {
				ref = val;
			}
			continue;
		}
		// 处理props
		if ({}.hasOwnProperty.call(config, prop)) {
			props[prop] = val;
		}
	}

	const maybeChildrenLength = maybeChildren.length;
	if (maybeChildrenLength) {
		if (maybeChildrenLength === 1) {
			// 如果第二个参数后只传入了一个参数，children为该对象
			props.children = maybeChildren[0];
		} else {
			props.children = maybeChildren; // 如后面有多个参数，children为数组
		}
	}
	return ReactElement(type, key, ref, props);
};

export const jsxDEV = (type: ElementType, config: any) => {
	const props: Props = {};
	let key: Key = null; // 保存key、ref这两个特殊对象
	let ref: Ref = null;

	for (const prop in config) {
		const val = config[prop];
		if (prop === 'key') {
			if (val !== undefined) {
				key = '' + val;
			}
			continue;
		}
		if (prop === 'ref') {
			if (val !== undefined) {
				ref = val;
			}
			continue;
		}
		// 处理props
		if ({}.hasOwnProperty.call(config, prop)) {
			props[prop] = val;
		}
	}

	return ReactElement(type, key, ref, props);
};

export function isValidElement(object: any) {
	return (
		typeof object === 'object' &&
		object !== null &&
		object.$$typeof === REACT_ELEMENT_TYPE
	);
}
