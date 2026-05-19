## 1. Artifact Setup

- [x] 1.1 Create a focused OpenSpec change for the empty model selection compatibility fix.
- [x] 1.2 Add a delta spec for local AI model-management behavior.

## 2. Implementation

- [x] 2.1 Change settings action-model clearing to send an empty-string model id.
- [x] 2.2 Update frontend API typing to document string-based clear payload support.
- [x] 2.3 Keep backend nullable compatibility unchanged.

## 3. Verification

- [x] 3.1 Update settings modal tests for the empty-string clear request.
- [x] 3.2 Update local AI API tests for the empty-string clear payload.
- [x] 3.3 Run focused frontend tests for settings and local AI API.
- [x] 3.4 Run relevant build/type checks.
