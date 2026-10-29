export const environment = {
  production: false,
  /**
   * 'api'  = real data through the local Worker (`npm run dev` at the repo root starts DB + API + this app;
   *          proxy.conf.json forwards /api to http://127.0.0.1:8787).
   * 'mock' = in-memory sample data, no backend needed (`npm run dev:mock` here). Shows a "ข้อมูลตัวอย่าง" banner.
   */
  dataSource: 'api' as 'mock' | 'api',
  apiBaseUrl: '/api',
};
