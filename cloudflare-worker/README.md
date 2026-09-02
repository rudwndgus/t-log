# T Log Google Maps URL resolver

This Worker expands only Google Maps short links. It is not a general-purpose proxy: input and the expanded result are allowlisted, execution time is bounded, and CORS is limited to the T Log GitHub Pages origin plus local development origins. It reads the first Google redirect with `HEAD`, retries temporary failures, and caches successful resolutions to avoid Google rate limits.

```bash
npm install
npx wrangler login
npm run deploy
```

Copy the resulting `workers.dev` URL into `VITE_GOOGLE_MAPS_RESOLVER_URL` locally and into the GitHub Actions repository variable with the same name.
