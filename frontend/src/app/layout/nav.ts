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
  { label: 'ขาย', path: '/sales', icon: 'bag' },
  { label: 'สต็อก', path: '/stock', icon: 'package' },
  { label: 'เมนูขนม', path: '/menu', icon: 'cake' },
];

export const MORE_NAV: NavItem[] = [
  { label: 'รายรับ-รายจ่าย', path: '/money', icon: 'wallet' },
  { label: 'คำนวณต้นทุน', path: '/cost', icon: 'calculator' },
  { label: 'สูตรขนม', path: '/recipes', icon: 'book' },
  { label: 'สแกนสินค้า', path: '/scan', icon: 'scan', comingSoon: true },
  { label: 'ตั้งค่า', path: '/settings', icon: 'settings', comingSoon: true },
];

/** Long labels for the desktop sidebar. */
export const SIDEBAR_LABEL: Partial<Record<string, string>> = {
  '/sales': 'บันทึกยอดขาย',
  '/stock': 'สต็อกวัตถุดิบ',
};
