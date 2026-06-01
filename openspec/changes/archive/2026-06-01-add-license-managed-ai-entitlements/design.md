## Context

Gitano currently has a Local AI entitlement concept, but it is a development stub controlled by `GITANO_LOCAL_AI_DEV_ENTITLEMENT`. AI workflows are already routed through typed Tauri adapters and backend commands, which gives us a good enforcement boundary: React can present locked/unlocked UX, while Rust commands can reject premium actions before any AI setup or repository context processing occurs.

The intended distribution model is free core Git workflows with premium AI features. The first version should import a local license file, verify it locally on every app launch, and perform regular server validation so cancelled, revoked, expired, or moved licenses stop enabling AI features.

## Goals / Non-Goals

**Goals:**

- Add a `License` entry beside `Settings` in the application menu.
- Let users import a local `.gitano-license` file.
- Verify signed license payloads locally using an embedded public key.
- Bind licenses to the current machine fingerprint.
- Store the imported license for offline launch-time checks.
- Regularly validate the license against a server so Gitano can detect invalidated licenses.
- Gate all premium AI features in backend Rust commands.
- Keep core Git functionality available without a license.

**Non-Goals:**

- Full payment, checkout, or subscription management UI.
- User account sign-in inside Gitano.
- A customer portal for activation reset or license purchase.
- Strong anti-crack guarantees. The model should stop casual misuse and enforce normal licensing, but offline desktop apps can still be patched by determined attackers.
- Per-feature pricing tiers beyond the initial AI premium entitlement.

## Decisions

1. **Use signed local license files plus regular validation**

   The app will import a signed license document containing payload, signature, key id, and version. The payload will include license id, customer display fields, plan, entitled features, machine fingerprint, issued timestamp, expiry timestamp, and validation metadata.

   Local verification keeps launches fast and allows offline use between validation windows. Server validation remains necessary to detect licenses that are revoked, cancelled, refunded, or moved to another machine.

   Alternative considered: server validation on every launch. This gives stricter control but makes app startup dependent on network availability and is less friendly for a desktop Git client.

2. **Keep the private key outside the desktop app**

   Gitano will embed only public verification keys. The activation/validation service owns private signing through a managed key service or equivalent secure backend. The app verifies signatures but never has the ability to mint valid licenses.

   Alternative considered: symmetric shared secret in the app. This is not acceptable because extracting the app secret would allow forged licenses.

3. **Enforce premium access in Rust commands**

   React will show the `License` window, status, and locked states, but backend commands must enforce access before premium AI operations continue. AI command guards should call one centralized licensing API such as `ensure_feature_entitled(PremiumFeature::Ai)`.

   Alternative considered: frontend-only gating. This is insufficient because Tauri commands can be invoked independently of disabled UI controls.

4. **Treat AI as the initial premium feature family**

   The first entitlement will cover AI features: local AI Git actions, local model setup/preferences needed for AI execution, external AI agents, and branch AI review. Core Git operations remain free.

   Alternative considered: gate individual AI actions separately from day one. The license payload can support feature arrays, but implementation should start with one AI premium family to avoid premature pricing complexity.

5. **Use a backend-owned machine fingerprint**

   Rust will compute the fingerprint from stable OS/device signals and app-owned salt, then hash the result before storage or server submission. The license payload stores the expected hashed fingerprint. The exact source signals should stay behind the backend API so React never owns fingerprint logic.

   Alternative considered: user-visible raw hardware IDs. This is privacy-hostile and brittle when hardware changes.

6. **Make regular validation lazy and non-blocking where possible**

   Local verification determines immediate launch status. If the license is within its validation grace window, the app may unlock premium features immediately and run validation in the background. If the license is outside its grace window, premium commands must fail until validation succeeds or a newly signed license is imported.

   Alternative considered: always block AI until online validation completes. This is simpler but worse for users who briefly lose connectivity.

## Risks / Trade-offs

- **Cracked binaries can bypass local checks** -> Keep checks centralized in Rust, sign licenses, avoid storing secrets in the app, and accept that this model is practical enforcement rather than perfect DRM.
- **Machine fingerprints can change for legitimate users** -> Hash multiple stable signals, keep the fingerprint algorithm tolerant where possible, and plan an activation reset/deactivation flow outside this initial app change.
- **Regular validation can annoy offline users** -> Use a grace window and clear status messaging so users understand when online refresh is required.
- **Clock tampering can extend local license validity** -> Store last successful validation time and reject suspicious time rollback beyond a small tolerance.
- **Key rotation will be needed later** -> Include `keyId` and `version` in the license envelope so multiple public keys can be supported.
- **Server endpoint shape may change** -> Keep validation behind a typed shared adapter and Rust licensing module so UI and AI features do not depend on raw endpoint details.
