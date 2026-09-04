import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // The Worker serves the app; browser code reads supported third-party sources directly.
  // No additional cache/storage bindings are required for this build.
});
