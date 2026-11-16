import { defineConfig } from 'vite';

export default defineConfig({
  base: './',                 // 相对路径，便于部署到任意子目录
  server: {
    port: 5173,
    open: true,
    // 若远程模型服务器有跨域限制，可在此配置代理：
    // proxy: { '/models': { target: 'https://your-model-server.com', changeOrigin: true } }
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // three 单独分包，利于浏览器缓存
        manualChunks: { three: ['three'] }
      }
    }
  }
});
