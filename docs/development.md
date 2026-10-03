# Development and deployment

## Run locally

Use Node.js 22.x (22.18 or newer), matching the Vercel build. In the project directory:

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

The production app is [antwork-five.vercel.app](https://antwork-five.vercel.app/). The Vercel project `antwork` is connected to `radware0/antwork`; pushes to `main` build and update production automatically.

The project uses the Other framework preset, the repository root, Node.js 22.x, `npm ci` for installation, `npm run build` for the build, and `dist` for output. `vercel.json` records the build settings and `package.json` pins the Node major version. No environment variables are required.

The app uses hash routes, so each app destination remains under the root page; generated documentation is served under `/docs/`. After a release, verify the production deployment matches the pushed commit and smoke-test all five destinations, `/docs/`, and a deeper docs page. The browser workflow accepts `QA_BASE_URL` to test the live URL in a fresh browser context. JSON backups now use schema version 5; this build imports versions 1–5. Older builds cannot read version-5 backups, so keep an up-to-date copy before moving data between app versions.

Browser storage is tied to a site origin. History saved at localhost will not magically appear on the Vercel domain: export JSON in Profile, then import it on the deployed origin if you want that copy there. Do not publish a real backup to the repository.

## Contribution boundary

This beta has no backend. Local input limits are present, but server rate limiting, account authorization, encrypted cloud storage, and abuse controls belong to the later hosted-service design. Do not present the static deployment as having those protections.
