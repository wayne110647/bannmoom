export const environment = {
  production: true,
  /** The deployed Worker serves this build and the API on the same origin (see api/wrangler.jsonc). */
  dataSource: 'api' as 'mock' | 'api',
  apiBaseUrl: '/api',
};
