import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProductRepository } from '../../core/data/repositories';
import { dec, sub, toNumber } from '../../core/domain/decimal';
import { createLoader } from '../../core/load-state';
import { PRODUCT_CATEGORIES, Product, ProductCategory } from '../../core/models';
import { ActionSheetService, SheetAction, SheetAnchor, anchorBelow } from '../../shared/action-sheet';
import { injectConfirmDelete } from '../../shared/confirm-delete';
import { BahtPipe } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { LongPress } from '../../shared/long-press';
import { PageHeader } from '../../shared/page-header';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { ProductThumb } from './product-thumb';

@Component({
  selector: 'app-product-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, PageHeader, Loading, ErrorState, EmptyState, ProductThumb, LongPress, BahtPipe],
  templateUrl: './product-list-page.html',
})
export class ProductListPage {
  private readonly repo = inject(ProductRepository);
  private readonly router = inject(Router);
  private readonly sheet = inject(ActionSheetService);
  private readonly confirmDelete = injectConfirmDelete();
  protected readonly anchorBelow = anchorBelow;
  protected readonly products = createLoader(() => this.repo.list());
  protected readonly search = signal('');
  protected readonly category = signal<ProductCategory | 'all'>('all');
  protected readonly categories = [{ value: 'all' as const, label: 'ทั้งหมด' }, ...PRODUCT_CATEGORIES];

  protected readonly visible = computed<Product[]>(() => {
    const s = this.products.state();
    if (s.status !== 'ready') return [];
    const term = this.search().trim().toLowerCase();
    const cat = this.category();
    return s.data.filter((p) => (cat === 'all' || p.category === cat) && (!term || p.name.toLowerCase().includes(term)));
  });

  /** Same menu from long-press, right-click, tapping the card and the "⋯" button. */
  protected openMenu(p: Product, anchor: SheetAnchor | null) {
    const actions: SheetAction[] = [];
    if (p.recipeId) {
      actions.push(
        { label: 'ดูต้นทุน', icon: 'calculator', run: () => this.router.navigate(['/cost'], { queryParams: { recipe: p.recipeId } }) },
        { label: 'แก้ไขเมนู', icon: 'pencil', run: () => this.router.navigate(['/recipes', p.recipeId, 'edit']) },
      );
    }
    actions.push({ label: 'ลบเมนู', icon: 'trash', danger: true, run: () => this.remove(p) });
    this.sheet.open(p.name, actions, { subtitle: `ขาย ${p.sellPrice} บาท/${p.saleUnit}`, anchor });
  }

  private remove(p: Product) {
    this.confirmDelete({
      name: p.name,
      detail: p.recipeId ? 'สูตรของเมนูนี้จะถูกลบด้วย — กด "เลิกทำ" ได้ทันทีถ้ากดผิด' : undefined,
      remove: () => this.repo.remove(p.id),
      restore: () => this.repo.restore(p.id),
      onRemoved: () => this.products.update((list) => list.filter((x) => x.id !== p.id)),
      onRestored: () => this.products.reload(),
    });
  }

  protected profit(p: Product): number | null {
    return p.costPerPiece === null ? null : toNumber(sub(dec(p.sellPrice), dec(p.costPerPiece)));
  }
}
