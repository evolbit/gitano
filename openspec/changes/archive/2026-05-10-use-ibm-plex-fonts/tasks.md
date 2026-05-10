## 1. Font Setup

- [x] 1.1 Add bundled IBM Plex font assets or a local font package path for `IBM Plex Sans` and `IBM Plex Mono`.
- [x] 1.2 Wire the global app font setup so the default UI font resolves to `IBM Plex Sans`.
- [x] 1.3 Wire the shared mono font token so code/hunk surfaces resolve to `IBM Plex Mono`.

## 2. Surface Application

- [x] 2.1 Ensure general app UI inherits the global IBM Plex Sans font without needing scattered per-component overrides.
- [x] 2.2 Ensure diff/hunk code surfaces continue to use the mono font through the shared mono token or equivalent centralized override.
- [x] 2.3 Ensure diff/hunk code uses an explicit diff font-size token so future app UI font-size changes do not implicitly rescale hunks.

## 3. Verification

- [x] 3.1 Verify the general app UI renders with IBM Plex Sans.
- [x] 3.2 Verify diff/hunk code renders with IBM Plex Mono.
- [x] 3.3 Verify the font setup does not depend on remote font loading at runtime.
