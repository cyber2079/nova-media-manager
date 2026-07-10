/**
 * Generate Ed25519 key pair for Tauri updater signing.
 *
 * Usage:
 *   node scripts/generate-updater-key.mjs
 *
 * Output:
 *   Private key — keep this SECRET, use with `tauri signer generate`
 *   Public key  — paste into tauri.conf.json plugins.updater.pubkey
 *
 * IMPORTANT: Store the private key securely. It's used to sign every release.
 * Never commit it to the repository.
 */

import crypto from "node:crypto";

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

console.log("═══════════════════════════════════════════");
console.log("  Tauri Updater Ed25519 Key Pair");
console.log("═══════════════════════════════════════════\n");

console.log("━━━ PRIVATE KEY (keep this SECRET!) ━━━");
console.log(privateKey);

console.log("━━━ PUBLIC KEY (paste into tauri.conf.json) ━━━");
console.log(publicKey);

console.log("───────────────────────────────────────────");
console.log("Next steps:");
console.log("1. Save the private key to a file outside the repo");
console.log("   e.g., ~/.tauri/my-app-updater-private.key");
console.log("");
console.log("2. In tauri.conf.json, set:");
console.log('   "plugins": { "updater": { "pubkey": "<paste public key>" } }');
console.log("");
console.log("3. When building releases, set TAURI_SIGNING_PRIVATE_KEY env var:");
console.log('   TAURI_SIGNING_PRIVATE_KEY="<paste private key>" npm run tauri:build');
console.log("");
console.log("4. The private key can also be saved as a file and referenced via:");
console.log("   TAURI_SIGNING_PRIVATE_KEY_PATH=~/.tauri/my-app-updater-private.key");
console.log("───────────────────────────────────────────");
