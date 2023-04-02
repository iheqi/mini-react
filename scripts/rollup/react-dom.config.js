import generatePackageJson from 'rollup-plugin-generate-package-json';
import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from './utils';
import alias from '@rollup/plugin-alias';
const { name, module, peerDependencies } = getPackageJSON('react-dom');

const pkgPath = resolvePkgPath(name);
const pkgDistPath = resolvePkgPath(name, true);

// jsxDEV方法（dev环境）
// jsx方法（prod环境）
// React.createElement方法

// 对应上述两3方法，打包对应文件：
// react/jsx-dev-runtime.js（dev环境）
// react/jsx-runtime.js（prod环境）
// React

export default [
	// react-dom
	{
		input: `${pkgPath}/${module}`,
		output: [
			{
				file: `${pkgDistPath}/index.js`,
				name: 'ReactDOM',
				format: 'umd'
			},
			{
				file: `${pkgDistPath}/client.js`, // react18的引入方式：import ReactDOM from 'react-dom/client';
				name: 'client',
				format: 'umd'
			}
		],
		// 避免 react 代码打包进 react-dom
		external: [...Object.keys(peerDependencies)],
		plugins: [
			...getBaseRollupPlugins(),
			alias({
				entries: {
					hostConfig: `${pkgPath}/src/hostConfig.ts`
				}
			}),
			generatePackageJson({
				// 打包输出 package.json 文件
				inputFolder: pkgPath,
				outputFolder: pkgDistPath,
				baseContents: ({ name, description, version }) => ({
					name,
					description,
					version,
					peerDependencies: {
						react: version
					},
					main: 'index.js'
				})
			})
		]
	},
	// react-dom: test-utils
	{
		input: `${pkgPath}/test-utils.ts`,
		output: [
			{
				file: `${pkgDistPath}/test-utils.js`,
				name: 'testUtils',
				format: 'umd'
			}
		],
		external: ['react', 'react-dom'],
		plugins: [...getBaseRollupPlugins()]
	}
];
