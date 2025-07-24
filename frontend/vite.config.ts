import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  const isDevelopment = mode === 'development'
  const isProduction = mode === 'production'
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/components': path.resolve(__dirname, './src/components'),
        '@/services': path.resolve(__dirname, './src/services'),
        '@/types': path.resolve(__dirname, './src/types'),
        '@/stores': path.resolve(__dirname, './src/stores'),
        '@/utils': path.resolve(__dirname, './src/utils'),
      },
    },
    server: {
      port: 3000,
      host: true, // Allow external connections
      strictPort: true, // Exit if port is already in use
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
          timeout: 30000,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request to the Target:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
            });
          },
        },
        '/socket.io': {
          target: env.VITE_SOCKET_URL || 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
          ws: true,
          timeout: 30000,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: isDevelopment,
      minify: isProduction ? 'esbuild' : false,
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            socket: ['socket.io-client'],
            utils: ['zustand'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    preview: {
      port: 3000,
      host: true,
      strictPort: true,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov'],
        reportsDirectory: './coverage',
        exclude: [
          'node_modules/',
          'src/test-setup.ts',
          '**/*.test.{ts,tsx}',
          '**/*.spec.{ts,tsx}',
          '**/__tests__/**',
          '**/dist/**',
          '**/build/**',
          '**/.{eslint,mocha,prettier}rc.{js,cjs,yml}',
          '**/vite.config.ts',
          '**/tailwind.config.js',
          '**/postcss.config.js',
        ],
        thresholds: {
          global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
          },
          // Per-file thresholds
          './src/components/**/*.{ts,tsx}': {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
          },
          './src/services/**/*.ts': {
            branches: 85,
            functions: 85,
            lines: 85,
            statements: 85,
          },
          './src/utils/**/*.ts': {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90,
          },
        },
        all: true,
        include: ['src/**/*.{ts,tsx}'],
        skipFull: false,
      },
      // Test timeout settings
      testTimeout: 10000,
      hookTimeout: 10000,
      // Fail tests on console errors/warnings in CI
      silent: process.env.CI === 'true',
      // Watch settings for development
      watch: !process.env.CI,
      // Parallel test execution
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: false,
          maxThreads: 4,
          minThreads: 1,
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'socket.io-client', 'zustand'],
    },
  }
})