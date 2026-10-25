import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadConfigFromFile } from "vite";

const names = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"] as const;
async function buildConfig(values: Record<string, string>) {
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    Object.assign(process.env, values);
    const loaded = await loadConfigFromFile({ command: "build", mode: "production" }, fileURLToPath(new URL("../../vite.config.ts", import.meta.url)));
    return loaded!.config.define ?? {};
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

test("the Vercel web build receives the shared project's public Supabase settings", async () => {
  const defines = await buildConfig({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example", SUPABASE_SECRET_KEY: "sb_secret_do_not_publish" });
  assert.equal(defines["import.meta.env.VITE_SUPABASE_URL"], JSON.stringify("https://example.supabase.co"));
  assert.equal(defines["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"], JSON.stringify("sb_publishable_example"));
  assert.equal(JSON.stringify(defines).includes("sb_secret_"), false);
});

test("explicit frontend settings take precedence for separate browser configurations", async () => {
  const defines = await buildConfig({ VITE_SUPABASE_URL: "https://web.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_web", SUPABASE_URL: "https://server.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_server" });
  assert.equal(defines["import.meta.env.VITE_SUPABASE_URL"], JSON.stringify("https://web.supabase.co"));
  assert.equal(defines["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"], JSON.stringify("sb_publishable_web"));
});
