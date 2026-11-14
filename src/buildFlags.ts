// Set by vite.config.ts from the build mode: `npm run build:resitel` builds the page for
// people taking the task. It leaves out the author's tools (calibration, sample
// evaluations), because those reveal the data traps. The code behind a false check is
// dropped from that build, so the samples are not even in the file.
declare const __PARTICIPANT_BUILD__: boolean;

export const isParticipantBuild: boolean = __PARTICIPANT_BUILD__;

// `npm run build:web` builds the public web version (docs/SPEC.md, section 13): like the
// participant page, but Claude is reached through the project's own server, which holds
// the API key, the evaluator's instructions and the evaluator key. None of those are in
// this build; the claude.ai code paths behind a false check are dropped from it.
declare const __WEB_BUILD__: boolean;

export const isWebBuild: boolean = __WEB_BUILD__;

// From package.json at build time (vite.config.ts). Release notes for it are in CHANGELOG.md.
declare const __APP_VERSION__: string;

export const appVersion: string = __APP_VERSION__;
