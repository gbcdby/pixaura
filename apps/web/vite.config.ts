import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
	// 加载环境变量（第三个参数 '' 表示加载所有变量，不限于 VITE_ 前缀）
	const env = loadEnv(mode, resolve(__dirname, "../../"), "");

	return {
		plugins: [vue()],
		resolve: {
			alias: {
				"@": resolve(__dirname, "src"),
			},
		},
		optimizeDeps: {
			include: ["@pixaura/shared-types"],
			// 排除 FFmpeg 包，避免预打包破坏 Worker 的动态加载机制
			exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util", "@ffmpeg/core-mt"],
			esbuildOptions: {
				target: "es2022",
			},
		},
		build: {
			commonjsOptions: {
				transformMixedEsModules: true,
			},
		},
		// FFmpeg.wasm 需要 SharedArrayBuffer 支持
		// 配置 worker 的头部，确保 worker 文件也能正确加载
		worker: {
			format: "es",
			// 为 Worker 添加 CORS headers，确保 FFmpeg.wasm 可以加载
		},
		server: {
			port: 5173,
			// FFmpeg.wasm 需要 SharedArrayBuffer 支持
			headers: {
				"Cross-Origin-Embedder-Policy": "require-corp",
				"Cross-Origin-Opener-Policy": "same-origin",
				// 为所有资源添加 Cross-Origin-Resource-Policy，解决 Worker 加载问题
				"Cross-Origin-Resource-Policy": "cross-origin",
			},
			proxy: {
				"/api": {
					target: env.APP_URL || "http://localhost:3000",
					changeOrigin: true,
				},
				"/socket.io": {
					target: env.APP_URL || "http://localhost:3000",
					changeOrigin: true,
					ws: true,
				},
				"/ws": {
					target: env.APP_URL || "http://localhost:3000",
					changeOrigin: true,
					ws: true,
				},
				// 静态资源代理优化
				"/static": {
					target:
						env.STORAGE_TYPE === "local"
							? "http://localhost:3000"
							: "http://pixaura.gbcdby.cn",
					changeOrigin: true,
					rewrite:
						env.STORAGE_TYPE === "local"
							? void 0
							: // OSS 模式需要去掉 /static 前缀
								(path) => path.replace(/^\/static/, ""),
				},
			},
		},
	};
});
