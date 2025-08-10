# NovAI Documentation

This is the documentation site for NovAI. It’s built with Mintlify (MDX + docs.json). All docs live in `apps/docs`.

## Prerequisites

- Node.js 20+
- pnpm 9+ (recommended)
- Mintlify CLI (`mint`) for local preview

Install the Mintlify CLI globally:

```bash
npm i -g mint
```

## Local development

From the project root:

```bash
cd apps/docs
mint dev
```

Then open `http://localhost:3000`.

## Project structure

- `apps/docs/docs.json`: Site configuration (theme, navigation, anchors, links)
- `apps/docs/*.mdx`: Top-level pages
- `apps/docs/**/`: Section folders (e.g., `engine/`, `ai-tools/`, `essentials/`)
- `apps/docs/images/`: Images used in docs
- `apps/docs/logo/`: Logo assets

Navigation is controlled by `docs.json`. New pages won’t appear in the sidebar until added there.

## Adding pages

1. Create an MDX file under `apps/docs/` (e.g., `engine/new-page.mdx`).
2. Add it to `docs.json` under an appropriate group.
3. Use Mintlify components for rich content (e.g., `Note`, `Tip`, `Steps`, `CodeGroup`).

Example MDX frontmatter:

```mdx
---
title: "My Page Title"
description: "Short description for nav/SEO"
---
```

## Authoring guidelines

- Keep sections concise and scannable with clear headings
- Prefer examples and short code snippets with language tags
- Use relative links for internal pages (e.g., `/engine/overview`)
- Store images in `apps/docs/images/` and use descriptive alt text

## Deployment

- You can deploy with Mintlify’s GitHub app or host the generated site elsewhere. See Mintlify’s docs for deployment details.

## Troubleshooting

- CLI not starting: `mint update` to upgrade the CLI
- 404 on a page: ensure it’s added under the correct group in `docs.json`

## Useful links

- Mintlify docs: https://mintlify.com/docs
- Components catalog: https://mintlify.com/docs/components/overview
