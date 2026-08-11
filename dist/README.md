# Meridian — built output

This folder is the production-ready static site. Serve it from any static host:

- **GitHub Pages** — copy every file here into your `gh-pages` branch (or push and let the `deploy.yml` workflow handle it).
- **Netlify / Cloudflare Pages / Vercel** — drag and drop this folder.
- **Nginx / Apache / S3** — copy these files under any web root.

The site uses **relative paths** (`base: './'`), so it works at any URL depth without rebuilding.

Everything Meridian tracks lives in your browser's `localStorage`. See the source repository for details and the export/import workflow.
