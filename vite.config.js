import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base './' + hash 路由：build 产物可直接双击 dist/index.html 离线打开
export default defineConfig({
  plugins: [vue()],
  base: './',
  server: {
    port: 5173,
    host: '127.0.0.1'
  }
})
