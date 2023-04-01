import generatePackageJson from 'rollup-plugin-generate-package-json';
import { getPackageJSON, resolvePkgPath, getBaseRollupPlugins } from "./utils";
import alias from '@rollup/plugin-alias';
const { name, module } = getPackageJSON('react-dom');

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
  // 
  {
    input: `${pkgPath}/${module}`,
    output: [{
      file: `${pkgDistPath}/index.js`,
      name: 'index.js',
      format: 'umd'
    }, {
      file: `${pkgDistPath}/client.js`, // react18的引入方式：import ReactDOM from 'react-dom/client';
      name: 'client.js',
      format: 'umd'
    }],
    plugins: [
      ...getBaseRollupPlugins(),
      alias({
        entries: {
          hostConfig: `${pkgPath}/src/hostConfig.ts`
        }
      }),
      generatePackageJson({ // 打包输出 package.json 文件
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
  }
]