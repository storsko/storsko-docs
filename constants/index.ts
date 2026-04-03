// Storsko Documentation - All Links

export const GITHUB_REPO = 'https://github.com/storsko/storsko-core';
export const GITHUB_STORSKO = 'https://github.com/storsko';
export const STORSKO_WEBSITE = 'https://storsko.com';
export const STORSKO_PRICING = 'https://storsko.com/pricing';
export const STORSKO_APP = 'https://app.storsko.com';

export const DOCS_LINKS = {
  intro: '/intro',
  gettingStarted: '/getting-started/',
  quickStart: '/getting-started/quick-start/',
  configuration: '/getting-started/configuration/',
  architecture: '/architecture/',
  coreConcepts: '/core-concepts/',
  capabilities: '/core-concepts/capabilities/',
  hitl: '/core-concepts/hitl/',
  auditLog: '/core-concepts/audit-log/',
  agents: '/core-concepts/agents/',
  apiReference: '/api-reference/',
  restApi: '/api-reference/',
  sdk: '/sdk/',
  deployment: '/deployment/',
  docker: '/deployment/',
  production: '/deployment/production/',
  commercial: '/commercial/',
  guides: '/guides/',
  teams: '/guides/teams/',
  compliance: '/guides/compliance/',
  llmGateway: '/guides/llm-gateway/',
} as const;

export const NAV_LINKS = [
  {
    title: 'Getting Started',
    to: DOCS_LINKS.gettingStarted,
    description: 'Install and run Storsko',
    icon: 'lucide:rocket',
  },
  {
    title: 'Core Concepts',
    to: DOCS_LINKS.coreConcepts,
    description: 'Authentication, capabilities, HITL, audit log',
    icon: 'lucide:book-open',
  },
  {
    title: 'Architecture',
    to: DOCS_LINKS.architecture,
    description: 'How Storsko is structured',
    icon: 'lucide:layers',
  },
  {
    title: 'API Reference',
    to: DOCS_LINKS.apiReference,
    description: 'REST API endpoints',
    icon: 'lucide:code',
  },
  {
    title: 'Deployment',
    to: DOCS_LINKS.deployment,
    description: 'Deploy with Docker',
    icon: 'lucide:container',
  },
] as const;

export const HEADER_LINKS = [
  {
    icon: 'lucide:github',
    to: GITHUB_REPO,
    target: '_blank' as const,
  },
] as const;

export const FOOTER_LINKS = [
  {
    icon: 'lucide:github',
    title: 'GitHub',
    to: GITHUB_REPO,
    target: '_blank',
  },
  {
    icon: 'lucide:globe',
    title: 'storsko.com',
    to: STORSKO_WEBSITE,
    target: '_blank',
  },
  {
    icon: 'lucide:credit-card',
    title: 'Pricing',
    to: STORSKO_PRICING,
    target: '_blank',
  },
] as const;

export const TOC_LINKS = [
  {
    title: 'Star on GitHub',
    icon: 'lucide:star',
    to: GITHUB_REPO,
    target: '_blank' as const,
    showLinkIcon: true,
  },
  {
    title: 'Create Issues',
    icon: 'lucide:circle-dot',
    to: `${GITHUB_REPO}/issues`,
    target: '_blank' as const,
    showLinkIcon: true,
  },
] as const;

export const EDIT_LINK_PATTERN = `${GITHUB_REPO}/edit/main/storsko-docs/content/:path`;
export const FOOTER_COPYRIGHT = '© 2026 Storsko GmbH';
