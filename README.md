# Ant GOAP Simulation

A browser-based ant colony simulation built with TypeScript, Vite, HTML Canvas, and GOAP-style planning. Ants explore a tile world, discover food, bring it back to the hive, rest when tired, and expand the hive by reserving and digging nearby dirt tiles.

## Requirements

- Node.js 24 or newer
- pnpm 11.1.3

## Local Development

```bash
pnpm install
pnpm dev
```

Open the local Vite URL printed by the command. The app is configured with the `/ant-simulator/` base path used by GitHub Pages.

## Quality Checks

```bash
pnpm format:check
pnpm lint
pnpm test
pnpm e2e
pnpm build
```

Run every check:

```bash
pnpm check
```

If Playwright browsers are not installed locally yet:

```bash
pnpm exec playwright install chromium
```

## Production Preview

```bash
pnpm build
pnpm preview
```

## GitHub Pages

The repository includes a Pages workflow in `.github/workflows/pages.yml`. It installs dependencies with pnpm, runs the full check suite, builds the app, and deploys `dist` to GitHub Pages.

The Vite base path is `/ant-simulator/`, matching the repository project page.

## License

MIT. See [LICENSE](LICENSE).
