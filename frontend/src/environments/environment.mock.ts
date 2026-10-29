/** `npm run dev:mock` — sample data in memory, no backend needed. Everything resets on refresh. */
export const environment = {
  production: false,
  dataSource: 'mock' as 'mock' | 'api',
  apiBaseUrl: '/api',
};
