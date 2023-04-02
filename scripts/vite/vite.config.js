import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import replace from '@rollup/plugin-replace';
import { resolvePkgPath } from '../rollup/utils';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		replace({
			__DEV__: true,
			preventAssignment: true
		})
	],
	resolve: {
		alias: [
			{
				find: 'react',
				replacement: resolvePkgPath('react')
				// replacement: '/Users/heqi/learn/lesson/big-react/packages/react'
			},
			{
				find: 'react-dom',
				replacement: resolvePkgPath('react-dom')
				// replacement: '/Users/heqi/learn/lesson/big-react/packages/react-dom'
			},
			{
				find: 'hostConfig',
				replacement: path.resolve(
					resolvePkgPath('react-dom'),
					'./src/hostConfig.ts'
				)
				// replacement:
				// '/Users/heqi/learn/lesson/big-react/packages/react-dom/src/hostConfig.ts'
			}
		]
	}
});
