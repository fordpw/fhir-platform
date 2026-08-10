import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

/**
 * Test configuration is kept out of vite.config.ts on purpose.
 *
 * Adding a `test` block there requires importing defineConfig from
 * vitest/config, whose plugin types disagree with Vite's own and break
 * `tsc -b` during `npm run build`. Merging here keeps the app build clean
 * while still reusing the React and Tailwind plugins so JSX is transformed
 * identically in tests.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // happy-dom rather than jsdom: a transitive dependency of jsdom
      // (html-encoding-sniffer -> @exodus/bytes) currently fails under ESM
      // with ERR_REQUIRE_ESM, which stops the suite collecting at all.
      environment: 'happy-dom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  })
)
