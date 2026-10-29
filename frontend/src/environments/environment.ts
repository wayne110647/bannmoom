export const environment = {
  production: false,
  /**
   * 'mock' = in-memory sample data (a "ข้อมูลตัวอย่าง" banner is shown).
   * 'api'  = real backend at apiBaseUrl. Switch once the Cloudflare Worker API is ready (Phase 2).
   */
  dataSource: 'mock' as 'mock' | 'api',
  apiBaseUrl: '/api',
};
