import { defineConfig } from "vitest/config";

// Only for `npm run pilot:custom-task`: calls the real Claude, never part of the normal test run.
export default defineConfig({
  define: { __PARTICIPANT_BUILD__: "false", __WEB_BUILD__: "true", __APP_VERSION__: '"pilot"' },
  test: { include: ["scripts/pilot/customTaskPilot.run.ts"], reporters: ["default"], silent: false, testTimeout: 30 * 60_000 },
});
