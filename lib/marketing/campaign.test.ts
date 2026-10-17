import assert from "node:assert/strict";
import test from "node:test";
import { buildCalendar, pickLead, runCampaign } from "./campaign.ts";
import type { ChatMessage } from "./suite.ts";

const env = {
  deepseekKey: "test",
  deepseekBaseUrl: "https://api.deepseek.com",
  dshModel: "deepseek-v4-flash",
  ollamaKey: "test",
  ollamaBaseUrl: "https://ollama.com",
  ollamaModel: "gemma4:31b-cloud",
  ollamaQualityModel: "qwen3.5:cloud",
};

test("calendar publishes the page first and spaces the posts", () => {
  const items = buildCalendar("2026-10-20", [
    { channel: "instagram", hook: "First", body: "One" },
    { channel: "linkedin", hook: "Second", body: "Two" },
  ], "Book a walkthrough");
  assert.deepEqual(items.map((item) => item.date), ["2026-10-20", "2026-10-21", "2026-10-23"]);
  assert.equal(items[0].channel, "site");
});

test("the lead variant is the highest score", () => {
  const lead = pickLead([
    { framework: "pas", score: 40 },
    { framework: "aida", score: 72 },
    { framework: "bab", score: 55 },
  ]);
  assert.equal(lead?.framework, "aida");
});

test("a campaign run keeps every section and scores the variants", async () => {
  const seen: string[] = [];
  const complete = async (model: string, messages: ChatMessage[]) => {
    seen.push(model);
    const ask = messages[1].content;
    assert.match(ask, /guaranteed rankings/);
    if (ask.includes('"title"')) {
      return JSON.stringify({ title: "Owned", idea: "Stop renting it.", audience: "owners", tension: "sprawl", promise: "one desk", proof: "", channels: ["site"] });
    }
    if (ask.includes('"headline"')) {
      return JSON.stringify({ headline: "Ship the page", subhead: "A clear offer.", problem: "The stack is rented.", offer: "MarketPro", proof_points: [], cta: "See the plan" });
    }
    if (ask.includes('"outline"')) {
      return JSON.stringify({ title: "MarketPro", description: "A marketing desk.", h1: "MarketPro", outline: ["Offer", "Proof"] });
    }
    if (ask.includes('"posts"')) {
      return JSON.stringify({ posts: [{ channel: "instagram", hook: "Ship the page", body: "Show the work you can prove.", cta: "Read" }] });
    }
    return JSON.stringify({ framework: "pas", blocks: { problem: "x" }, hook: "A honest hook for the offer", body: "The body explains the offer without a fake metric.", cta: "See it" });
  };

  const campaign = await runCampaign(
    { offer: "a marketing desk", start: "2026-10-20", brand: { name: "Arkhe", banned: ["guaranteed rankings"], proof: "" } },
    { env, completeDsh: complete, completeOllama: complete },
  );

  assert.equal(campaign.brief.ok, true);
  assert.equal(campaign.landing.ok, true);
  assert.equal(campaign.seo.ok, true);
  assert.equal(campaign.social.ok, true);
  assert.equal(campaign.variants.length, 3);
  assert.ok(campaign.lead);
  assert.equal(campaign.placements.length, 4);
  assert.equal(campaign.calendar[0].title, "Publish the landing page");
  assert.ok(seen.includes("deepseek-v4-flash"));
  assert.ok(seen.includes("qwen3.5:cloud"));
});

test("a failed DeepSeek section does not drop the cloud sections", async () => {
  const campaign = await runCampaign(
    { offer: "offer", provider: "auto" },
    {
      env,
      completeDsh: async () => {
        throw new Error("DEEPSEEK_API_KEY is not set");
      },
      completeOllama: async () => JSON.stringify({
        title: "Cloud",
        description: "Still here.",
        h1: "Cloud",
        outline: [],
        posts: [],
        framework: "pas",
        blocks: {},
        hook: "Cloud hook stays",
        body: "The everyday copy still comes back from Ollama.",
        cta: "Read",
        headline: "unused",
        idea: "unused",
      }),
    },
  );
  assert.equal(campaign.brief.ok, true);
  assert.equal(campaign.brief.ok && campaign.brief.value.route.fallback_from, "dsh");
  assert.equal(campaign.seo.ok, true);
});
