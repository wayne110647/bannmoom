import { IconName } from '../shared/icon';

export interface NavItem {
  label: string;
  path: string;
  icon: IconName;
  /** Shown as "เร็ว ๆ นี้" until the feature's phase is built. */
  comingSoon?: boolean;
}

export const MAIN_NAV: NavItem[] = [
  { label: 'หน้าแรก', path: '/', icon: 'home' },
  { label: 'เมนูขนม', path: '/menu', icon: 'cake' },
  { label: 'สต็อก', path: '/stock', icon: 'package' },
  { label: 'ออเดอร์', path: '/orders', icon: 'clipboard', comingSoon: true },
];

export const MORE_NAV: NavItem[] = [
  { label: 'คำนวณต้นทุน', path: '/cost', icon: 'calculator' },
  { label: 'สูตรขนม', path: '/recipes', icon: 'book' },
  { label: 'สแกนสินค้า', path: '/scan', icon: 'scan', comingSoon: true },
  { label: 'รายงาน', path: '/reports', icon: 'chart', comingSoon: true },
  { label: 'ตั้งค่า', path: '/settings', icon: 'settings', comingSoon: true },
];

/** Long labels for the desktop sidebar. */
export const SIDEBAR_LABEL: Partial<Record<string, string>> = {
  '/stock': 'สต็อกวัตถุดิบ',
  '/orders': 'ออเดอร์และยอดขาย',
};
