/** `npm run dev:api` — live-reload frontend talking to the local Worker (`npm run dev` in ../api) via proxy.conf.json. */
export const environment = {
  production: false,
  dataSource: 'api' as 'mock' | 'api',
  apiBaseUrl: '/api',
};
