import { Routes } from '@angular/router';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', title: 'หน้าแรก', loadComponent: () => import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage) },
      { path: 'menu', title: 'เมนูขนม', loadComponent: () => import('./features/products/product-list-page').then((m) => m.ProductListPage) },
      {
        path: 'stock',
        children: [
          { path: '', title: 'สต็อกวัตถุดิบ', loadComponent: () => import('./features/ingredients/ingredient-list-page').then((m) => m.IngredientListPage) },
          { path: 'new', title: 'เพิ่มวัตถุดิบ', loadComponent: () => import('./features/ingredients/ingredient-form-page').then((m) => m.IngredientFormPage) },
          { path: ':id', title: 'รายละเอียดวัตถุดิบ', loadComponent: () => import('./features/ingredients/ingredient-detail-page').then((m) => m.IngredientDetailPage) },
          { path: ':id/edit', title: 'แก้ไขวัตถุดิบ', loadComponent: () => import('./features/ingredients/ingredient-form-page').then((m) => m.IngredientFormPage) },
          { path: ':id/move/:type', title: 'บันทึกสต็อก', loadComponent: () => import('./features/ingredients/stock-movement-page').then((m) => m.StockMovementPage) },
        ],
      },
      {
        path: 'recipes',
        children: [
          { path: '', title: 'สูตรขนม', loadComponent: () => import('./features/recipes/recipe-list-page').then((m) => m.RecipeListPage) },
          { path: 'new', title: 'เพิ่มเมนูใหม่', loadComponent: () => import('./features/recipes/recipe-form-page').then((m) => m.RecipeFormPage) },
          { path: ':id/edit', title: 'แก้ไขเมนู', loadComponent: () => import('./features/recipes/recipe-form-page').then((m) => m.RecipeFormPage) },
        ],
      },
      { path: 'cost', title: 'คำนวณต้นทุน', loadComponent: () => import('./features/cost-calculator/cost-calculator-page').then((m) => m.CostCalculatorPage) },
      { path: 'more', title: 'เพิ่มเติม', loadComponent: () => import('./features/more/more-page').then((m) => m.MorePage) },
      ...(
        [
          ['orders', 'ออเดอร์และยอดขาย'],
          ['scan', 'สแกนสินค้า'],
          ['reports', 'รายงาน'],
          ['settings', 'ตั้งค่า'],
        ] as const
      ).map(([path, title]) => ({
        path,
        title,
        data: { heading: title },
        loadComponent: () => import('./features/more/coming-soon-page').then((m) => m.ComingSoonPage),
      })),
      { path: '**', redirectTo: '' },
    ],
  },
];
