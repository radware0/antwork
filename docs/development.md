# Development and deployment

## Run locally

Use Node.js 22.18 or newer. In the project directory:

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. On Windows PowerShell, use `npm.cmd` if script execution blocks `npm`. The development server is the project's esbuild script; this workspace path contains `#`, which previously caused problems with a Vite setup.

## Verify a change

```sh
npm test
npm run build
npm run test:browser
```

Start the development server before `test:browser`. The browser workflow uses Chromium through Playwright; install that browser if your machine does not already have it (`npm exec -- playwright install chromium`). The tests cover time calculations, backup migrations, the daily loop, dialogs, responsive navigation, and more. A build writes the static app and generated documentation to `dist/`.

## Publish the beta

Before pushing the public GitHub repository, review staged files, confirm no secrets or personal JSON backups are present, and keep `node_modules/`, `dist/`, `.qa/`, and local implementation scratch files out of version control. The public documentation source is in `docs/`; generated HTML is not the source of truth. Registry-installed source attribution is in `THIRD_PARTY_NOTICES.md`; antwork itself has no project-wide license in this beta.

Vercel deployment is a later release action, separate from the first GitHub push. When ready, use a static/Other project with `npm run build` as the build command and `dist` as the output directory. `vercel.json` records these settings. The app uses hash routes, so each app destination remains under the root page; the generated documentation is served under `/docs/`. Smoke-test Dashboard, all five dock destinations, `/docs/`, and a deeper docs page after deployment.

Browser storage is tied to a site origin. History saved at localhost will not magically appear on the Vercel domain: export JSON in Profile, then import it on the deployed origin if you want that copy there. Do not publish a real backup to the repository.

## Contribution boundary

This beta has no backend. Local input limits are present, but server rate limiting, account authorization, encrypted cloud storage, and abuse controls belong to the later hosted-service design. Do not present the static deployment as having those protections.
