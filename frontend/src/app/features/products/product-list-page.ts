import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductRepository } from '../../core/data/repositories';
import { dec, sub, toNumber } from '../../core/domain/decimal';
import { createLoader } from '../../core/load-state';
import { PRODUCT_CATEGORIES, Product, ProductCategory } from '../../core/models';
import { BahtPipe } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { ProductThumb } from './product-thumb';

@Component({
  selector: 'app-product-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, PageHeader, Loading, ErrorState, EmptyState, ProductThumb, BahtPipe],
  templateUrl: './product-list-page.html',
})
export class ProductListPage {
  private readonly repo = inject(ProductRepository);
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

  protected profit(p: Product): number | null {
    return p.costPerPiece === null ? null : toNumber(sub(dec(p.sellPrice), dec(p.costPerPiece)));
  }
}
