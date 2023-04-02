import generatePackageJson from 'rollup-plugin-generate-package-json';
import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from './utils';

const { name, module } = getPackageJSON('react');

// react包的路径
const pkgPath = resolvePkgPath(name);

// react产物路径
const pkgDistPath = resolvePkgPath(name, true);

// jsxDEV方法（dev环境）
// jsx方法（prod环境）
// React.createElement方法

// 对应上述两3方法，打包对应文件：
// react/jsx-dev-runtime.js（dev环境）
// react/jsx-runtime.js（prod环境）
// React

export default [
	//
	{
		input: `${pkgPath}/${module}`,
		output: {
			file: `${pkgDistPath}/index.js`,
			name: 'React',
			format: 'umd'
		},
		plugins: [
			...getBaseRollupPlugins(),
			generatePackageJson({
				// 打包输出 package.json 文件
				inputFolder: pkgPath,
				outputFolder: pkgDistPath,
				baseContents: ({ name, description, version }) => ({
					name,
					description,
					version,
					main: 'index.js'
				})
			})
		]
	},
	// jsx-runtime
	{
		input: `${pkgPath}/src/jsx.ts`,
		output: [
			// jsx-runtime
			{
				file: `${pkgDistPath}/jsx-runtime.js`,
				name: 'jsx-runtime',
				formate: 'umd'
			},
			// jsx-dev-runtime
			{
				file: `${pkgDistPath}/jsx-dev-runtime.js`,
				name: 'jsx-dev-runtime',
				formate: 'umd'
			}
		],
		plugins: getBaseRollupPlugins()
	}
];
