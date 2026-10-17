# MarketPro

Next.js marketing app for Vercel. A site asks for a job, and MarketPro picks the model.

- Briefs and landing pages use DeepSeek (`deepseek-v4-flash`), the official route DeepSeek Harness calls `deepseek-official`.
- SEO, social, and framework copy use Ollama Cloud. `qwen3.5:cloud` is the default. `gemma4:31b-cloud` is the cheaper draft.
- `deepseek-v4-pro:cloud` is never selected unless the request names it.
- If DeepSeek is unavailable and the route is Auto, the job falls through to Ollama Cloud and the response says so.

## Routes

- `POST /api/marketing/campaign` runs the desk: brief, landing page, SEO, social posts, three scored variants, placement packs, and a 14-day calendar
- `POST /api/marketing/generate` with `{ job, offer, provider, model, quality }`
- `GET /api/marketing/providers`
- `POST /api/marketing/score`
- `POST /api/marketing/placements`

A campaign sends strategy to DeepSeek and the everyday pieces to Ollama Cloud in parallel. A section that fails stays in the response as an error so the rest of the desk still comes back. The page keeps the last run in the browser.

`provider` is `auto`, `dsh`, or `ollama_cloud`. `job` is `brief`, `landing`, `seo`, `social`, or `framework`.

## Setup

Copy `.env.example` to `.env.local` and set `DEEPSEEK_API_KEY` and `OLLAMA_API_KEY`. On Vercel, add those same variables to the project. They stay on the server.

```bash
npm install
npm test
npm run dev
```
