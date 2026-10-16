import assert from "node:assert/strict";
import test from "node:test";
import { generate, placementPack, resolveRoute, scoreCopy, type Env } from "./suite.ts";

const env: Env = {
  deepseekKey: "test",
  deepseekBaseUrl: "https://api.deepseek.com",
  dshModel: "deepseek-v4-flash",
  ollamaKey: "test",
  ollamaBaseUrl: "https://ollama.com",
  ollamaModel: "gemma4:31b-cloud",
  ollamaQualityModel: "qwen3.5:cloud",
};

test("auto sends strategy to DeepSeek and cheap social to Ollama Cloud", () => {
  const deep = resolveRoute("brief", "auto", null, "good", env);
  const everyday = resolveRoute("social", "auto", null, "low", env);
  assert.equal(deep.provider, "dsh");
  assert.equal(deep.model, "deepseek-v4-flash");
  assert.equal(everyday.provider, "ollama_cloud");
  assert.equal(everyday.model, "gemma4:31b-cloud");
});

test("caller can pick the model", () => {
  assert.deepEqual(resolveRoute("landing", "ollama_cloud", "qwen3.5:cloud", "good", env), {
    provider: "ollama_cloud",
    model: "qwen3.5:cloud",
    job: "landing",
  });
});

test("generate keeps the honesty rule and the chosen route", async () => {
  let system = "";
  const out = await generate(
    { job: "brief", offer: "a website marketing app", provider: "dsh" },
    {
      env,
      completeDsh: async (_model, messages) => {
        system = messages[0].content;
        return JSON.stringify({
          title: "Owned systems",
          idea: "Stop renting a stack you cannot inspect.",
          audience: "operators",
          tension: "tool sprawl",
          promise: "a site that runs on the model you pick",
          proof: "",
          channels: ["site"],
        });
      },
    },
  );
  assert.equal(out.route.provider, "dsh");
  assert.equal(out.output.title, "Owned systems");
  assert.match(system, /Never invent/);
});

test("missing DeepSeek falls back to Ollama Cloud on auto", async () => {
  const out = await generate(
    { job: "brief", offer: "offer" },
    {
      env,
      completeDsh: async () => {
        throw new Error("DEEPSEEK_API_KEY is not set");
      },
      completeOllama: async () => JSON.stringify({ title: "Fallback", idea: "cloud" }),
    },
  );
  assert.equal(out.route.provider, "ollama_cloud");
  assert.equal(out.route.fallback_from, "dsh");
});

test("score flags a banned guarantee", () => {
  const scored = scoreCopy({
    hook: "Guaranteed rankings in a week",
    body: "We publish the pages and show the work.",
    cta: "See the plan",
    banned: ["guaranteed rankings"],
  });
  const clean = scoreCopy({
    hook: "Guaranteed rankings in a week",
    body: "We publish the pages and show the work.",
    cta: "See the plan",
  });
  assert.equal(scored.score, clean.score - 20);
  assert.ok(scored.flags.some((flag) => flag.includes("banned claim")));
  assert.match(scored.label, /not measured/);
});

test("google headlines are trimmed and nothing is published", () => {
  const pack = placementPack("google", {
    hook: "This headline is definitely longer than thirty characters",
    body: "A description that is also much longer than the search ad limit and should be cut.",
    cta: "Read",
  });
  const headline = pack.placements.find((row) => row.placement === "rsa_headlines");
  assert.equal(headline?.hook.length, 30);
  assert.match(pack.note, /^Export pack only/);
});
