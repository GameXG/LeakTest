import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Current pages rely on direct fetches and route handlers only.
  // No additional cache/storage bindings are required for this build.
});
