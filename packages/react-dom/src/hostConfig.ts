// 宿主环境：node or 浏览器
// 供 react-reconciler调用
export type Container = Element;
export type Instance = Element;

export const createInstance = (type: string, props: any): Instance => {
	const element = document.createElement(type) as Element;
	return element;
};

export const appendInitialChild = (parent: Instance, child: Instance) => {
	parent.appendChild(child);
};

export const createTextInstance = (content: string) => {
	return document.createTextNode(content);
};

export const appendChildToContainer = (
	child: Instance,
	container: Container
) => {
	container.appendChild(child);
};
