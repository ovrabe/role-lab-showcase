import { defineConfig } from "vitest/config";

// Only for `npm run calibrate`: the runner reads the fixtures through import.meta.glob, which
// needs Vite, and the build flags the app code expects. The normal test run never includes it.
export default defineConfig({
  define: { __PARTICIPANT_BUILD__: "false", __WEB_BUILD__: "false", __APP_VERSION__: '"calibration"' },
  test: {
    include: ["scripts/calibrate/calibrate.run.ts"],
    reporters: ["default"],
    // Show the progress lines while waiting for the batch.
    silent: false,
  },
});
