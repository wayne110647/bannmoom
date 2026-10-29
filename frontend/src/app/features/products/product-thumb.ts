import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ProductCategory } from '../../core/models';

/** Product photo, or a soft colored tile with the first letter when no photo is uploaded yet. */
const TILE_COLORS: Record<ProductCategory, string> = {
  brownie: 'from-[#8b6a55] to-[#5b4134]',
  cookie: 'from-[#d8b48c] to-[#b48a63]',
  cake: 'from-[#e3c9b2] to-[#c9a88d]',
  bread: 'from-[#ecd6b5] to-[#d3b083]',
  other: 'from-[#e9ded2] to-[#c9b6a4]',
};

@Component({
  selector: 'app-product-thumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block overflow-hidden rounded-xl' },
  template: `
    @if (imageUrl()) {
      <img [src]="imageUrl()" [alt]="name()" class="size-full object-cover" loading="lazy" />
    } @else {
      <div class="flex size-full items-center justify-center bg-gradient-to-br text-white/90" [class]="tile()" aria-hidden="true">
        <span class="text-2xl font-medium">{{ initial() }}</span>
      </div>
    }
  `,
})
export class ProductThumb {
  name = input.required<string>();
  imageUrl = input<string | null>(null);
  category = input<ProductCategory>('other');
  protected tile = computed(() => TILE_COLORS[this.category()]);
  /** First consonant — Thai leading vowels (เ แ โ ใ ไ) alone look odd. */
  protected initial = computed(() => this.name().replace(/^[เแโใไ]/, '').charAt(0));
}
