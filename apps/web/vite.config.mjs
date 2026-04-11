// Plugins
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import Fonts from "unplugin-fonts/vite";
import Layouts from "vite-plugin-vue-layouts";
import Vue from "@vitejs/plugin-vue";
import VueRouter from "unplugin-vue-router/vite";
import Vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
import { PrimeVueResolver } from "@primevue/auto-import-resolver";
import { VitePWA } from 'vite-plugin-pwa';
import * as sass from "sass";
import vueDevTools from 'vite-plugin-vue-devtools'
import { visualizer } from 'rollup-plugin-visualizer';

// Utilities
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern",
        importers: [
          new sass.NodePackageImporter()
        ]
      },
      sass: {
        api: "modern",
        importers: [
          new sass.NodePackageImporter()
        ]
      },
    }
  },
  plugins: [

    VueRouter(),
    Layouts(),
    Vue({
      template: { transformAssetUrls },
    }),
    // https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin#readme
    Vuetify({
      autoImport: true,
      styles: {
        configFile: "src/styles/settings.scss",
      },
    }),
    Components({
      // 排除需要 defineAsyncComponent 懒加载的重型组件，防止自动注入静态 import 覆盖动态导入
      globs: [
        'src/components/**/*.vue',
        '!src/components/EditorMonacoComponent.vue',
        '!src/components/DiffMonacoComponent.vue',
        '!src/components/admin/CodeRunTerminal.vue',
      ],
    }),
    Fonts({
      google: {
        families: [
          {
            name: "Roboto",
            styles: "wght@100;300;400;500;700;900",
          },
        ],
      },
    }),
    AutoImport({
      imports: ["vue", "vue-router"],
      eslintrc: {
        enabled: true,
      },
      vueTemplate: true,
    }),
    PrimeVueResolver(),
            vueDevTools(),

    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'generateSW',
      workbox: {
        // 只预缓存 /assets/ 路径下的特定类型文件
        globPatterns: ['assets/**/*.{js,css,html,ico,png,jpg,jpeg,svg,woff,woff2}'],

        // 单页应用的回退页面
        navigateFallback: '/index.html',


        importScripts: ['/pwa-notifications.js'],

        // 忽略不需要缓存的文件
        globIgnores: [
          '**/node_modules/**/*',
          '**/@id/**/*',
          '**/virtual:*',
          '**/?*',
          '**/manifest.webmanifest'
        ],

        // 允许的导航 fallback 路径
        navigateFallbackAllowlist: [/^(?!\/@id).*$/],

        // 运行时缓存：仅缓存 /assets/ 路径下的图片
        runtimeCaching: [
          {
            urlPattern: /\/assets\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-images',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 缓存 30 天
              }
            }
          }
        ]
      },
       skipThirdPartyRequests: true,
      manifest: {
        name: 'ZeroCat社区',
        short_name: 'ZeroCat',
        description: 'ZeroCat是新一代开源编程社区！创作、浏览、分享Scratch作品，体验多种不同的编辑器创作。',
        theme_color: '#1976d2',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/favicon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/favicon.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/favicon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        categories: ['education', 'productivity', 'developer'],
        shortcuts: [
          {
            name: '创建项目',
            short_name: '创建',
            description: '创建新的编程项目',
            url: '/app/create',
            icons: [{ src: '/favicon.png', sizes: '96x96' }]
          },
          {
            name: '通知中心',
            short_name: '通知',
            description: '查看最新通知',
            url: '/app/notifications',
            icons: [{ src: '/favicon.png', sizes: '96x96' }]
          }
        ]
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    }),
    /*copyPlugin(
      {
        targets: [{ src: "scratch-gui/build", dest: "dist" }],
        verbose: true,
        hook: "writeBundle",
      },
      {
        targets: [{ src: "scratch-gui/build", dest: "dist" }],
        verbose: true,
        hook: "buildEnd",
      }
    ),*/

    // 构建分析工具（仅 build 时生成报告）
    visualizer({
      filename: 'stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  define: { "process.env": {} },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    extensions: [".js", ".json", ".jsx", ".mjs", ".ts", ".tsx", ".vue"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vuetify': ['vuetify'],
          'vendor-primevue': ['primevue'],
          'vendor-echarts': ['echarts', 'vue-echarts'],
          'vendor-markdown': ['markdown-it', 'markdown-it-emoji', 'dompurify', 'highlight.js'],
          'vendor-xterm': ['@xterm/xterm', '@xterm/addon-fit'],
          'vendor-sentry': ['@sentry/vue'],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
  base: '/',
});
