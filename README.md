<div align="center">
  <picture>
    <source srcset="/logo-dark.svg" media="(prefers-color-scheme: dark)" />
    <img src="/logo.svg" alt="Storsko" height="64" />
  </picture>

# Storsko Documentation

[![License: CC BY 4.0](https://img.shields.io/badge/License-CC_BY_4.0-blue.svg)](https://creativecommons.org/licenses/by/4.0/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-9+-yellow.svg)](https://pnpm.io)

Enterprise governance for AI agent runtimes. Build, deploy, and monitor AI agents with confidence. EU-AI Act, DSVGO conform.

[🌐 storsko.com](https://storsko.com) &nbsp;|&nbsp; [📦 Open Source (storsko-core)](https://github.com/storsko/storsko-core) &nbsp;|&nbsp; [🚀 Live Docs](https://docs.storsko.com)

</div>

---

## Overview

Storsko provides enterprise-grade governance for AI agent runtimes with features like:

- **Execution Adapter** — Governance chokepoint for all tool calls with HITL modes and audit chain
- **Agent Hub** — External agent registration and Node protocol for proxied tool calls
- **LLM Gateway** — Multi-provider LLM routing with PII scanning
- **Capability Registry** — 25 built-in capabilities with risk-level grant validation
- **Audit Log** — Append-only SHA256 hash chain for tamper-proof logging

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Documentation Sections

| Section | Description |
|---------|-------------|
| [Getting Started](./content/getting-started/) | Installation and first steps |
| [Core Concepts](./content/core-concepts/) | Key concepts and architecture |
| [Architecture](./content/architecture/) | System design and components |
| [Guides](./content/guides/) | Step-by-step tutorials |
| [API Reference](./content/api-reference/) | API documentation |
| [Deployment](./content/deployment/) | Deployment guides |
| [SDK](./content/sdk/) | Client SDK documentation |

## Tech Stack

- **Framework**: [Nuxt 3](https://nuxt.com/) + [Vue 3](https://vuejs.org/)
- **Content**: [Nuxt Content](https://content.nuxt.com/)
- **UI**: [shadcn-nuxt](https://nuxt.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide](https://lucide.dev/)

## Project Structure

```
storsko-docs/
├── content/           # Documentation markdown files
│   ├── intro.md
│   ├── getting-started/
│   ├── core-concepts/
│   ├── architecture/
│   ├── guides/
│   └── api-reference/
├── components/         # Vue components (overrides + custom)
├── constants/          # Navigation links and site constants
├── public/             # Static assets (logos, favicon, OG image)
└── nuxt.config.ts      # Nuxt configuration
```

## Contributing

Contributions are welcome! Please open an issue or PR on the [storsko-core](https://github.com/storsko/storsko-core) repository.

## License

This documentation is licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

Storsko Core software is AGPL-3.0 open source - see [LICENSE](https://github.com/storsko/storsko-core/blob/main/LICENSE) for details.

