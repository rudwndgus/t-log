# T Log Google Maps URL resolver

This Worker expands only Google Maps short links. It is not a general-purpose proxy: input and every redirect target are allowlisted, redirects and execution time are bounded, and CORS is limited to the T Log GitHub Pages origin plus local development origins.

```bash
npm install
npx wrangler login
npm run deploy
```

Copy the resulting `workers.dev` URL into `VITE_GOOGLE_MAPS_RESOLVER_URL` locally and into the GitHub Actions repository variable with the same name.
