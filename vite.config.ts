import { defineConfig } from 'vite'
import path from 'node:path'
import pkg from './package.json'
import zdjl from 'vite-mjs-to-zjs'

const dep = Object.keys(pkg.dependencies)

function filepath(relative: string) {
  return path.join(import.meta.dirname, relative)
}

const zdjlConfig = () =>
  defineConfig({
    plugins: [
      zdjl({
        output: {
          formats: ['zjs'],
          filename: 'testWebsocketClient',
          outdir: './dist'
        },
        manifest: {
          description: `build-date: ${new Date().toLocaleString()}\nversion: ${pkg.version}\nauthor: ${pkg.author}\nlicense: ${pkg.license}`,
          count: -1,
        }
      }),
    ],
    resolve: {
      alias: {
        '@': filepath('./src'),
      }
    },
    build: {
      target: 'es2022',
      minify: false,
      outDir: './cache/',
      lib: {
        entry: filepath('src/test/client.test.ts'),
        formats: ['es'],
        fileName: 'index.zdjl'
      },
      rollupOptions: {
        treeshake: {
          moduleSideEffects: false
        },
        external: [/node:/, ...dep],
      }
    },
  })

const config = () =>
  defineConfig({
    plugins: [
    ],
    resolve: {
      alias: {
        '@': filepath('./src'),
      }
    },
    build: {
      minify: false,
      target: 'node18',
      lib: {
        entry: {
          index: filepath('./src/index.ts'),
        },
        formats: ['es'],
      },
      rollupOptions: {
        treeshake: {
          moduleSideEffects: false
        },
        external: [
          ...dep, /^node:/, 'querystring', 'zlib', 'path', 'async_hooks', 'events',
          'stream', 'fs', 'string_decoder', 'buffer', 'body-parser'
        ],
      }
    },
  })

export default defineConfig(({ mode }) => {
  if (mode === 'zdjl') {
    return zdjlConfig()
  } else {
    return config()
  }
})
