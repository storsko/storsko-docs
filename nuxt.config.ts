import {
  GITHUB_REPO,
  STORSKO_WEBSITE,
  STORSKO_PRICING,
  HEADER_LINKS,
  FOOTER_LINKS,
  TOC_LINKS,
  EDIT_LINK_PATTERN,
} from './constants/index.js';

export default defineNuxtConfig({
  devtools: { enabled: true },
  extends: ['shadcn-docs-nuxt'],

  site: {
    url: 'https://docs.storsko.com',
    name: 'Storsko Documentation',
  },

  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      htmlAttrs: { lang: 'en' },
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'canonical', href: 'https://docs.storsko.com' },
      ],
      meta: [
        { name: 'theme-color', content: '#09090b' },
        { name: 'author', content: 'Storsko GmbH' },
        { name: 'robots', content: 'index, follow' },
        { property: 'og:site_name', content: 'Storsko Documentation' },
        { property: 'og:type', content: 'website' },
        { property: 'og:locale', content: 'en_US' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:site', content: '@storsko' },
      ],
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: [
      {
        code: 'en',
        name: 'English',
        language: 'en-US',
      },
    ],
  },

  content: {
    highlight: {
      theme: {
        default: 'github-light',
        dark: 'github-dark',
      },
      preload: ['json', 'js', 'ts', 'html', 'css', 'vue', 'diff', 'shell', 'markdown', 'mdc', 'yaml', 'bash', 'ini', 'dotenv'],
    },
    navigation: {
      fields: [
        'icon',
        'navBadges',
        'badges',
        'toc',
        'sidebar',
        'collapse',
        'editLink',
        'prevNext',
        'breadcrumb',
        'fullpage',
      ],
    },
    experimental: {
      search: {
        indexed: true,
      },
    },
  },

  icon: {
    clientBundle: {
      scan: true,
      sizeLimitKb: 512,
    },
  },

  fonts: {
    defaults: {
      weights: ['300 800'],
    },
  },

  nitro: {
    prerender: {
      failOnError: false,
      crawlLinks: true,
    },
    compressPublicAssets: true,
  },

  routeRules: {
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    },
  },

  vite: {
    optimizeDeps: {
      include: [
        'dayjs',
        '@braintree/sanitize-url',
      ]
    }
  },

  compatibilityDate: '2025-05-13',
});
