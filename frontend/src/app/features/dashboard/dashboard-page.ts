import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BRAND } from '../../core/brand';
import { DashboardRepository } from '../../core/data/repositories';
import { createLoader } from '../../core/load-state';
import { BahtPipe } from '../../shared/format';
import { Icon, IconName } from '../../shared/icon';
import { ErrorState, Loading } from '../../shared/states';
import { ProductThumb } from '../products/product-thumb';

interface Shortcut {
  label: string;
  path: string;
  icon: IconName;
}

@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, BahtPipe, Loading, ErrorState, ProductThumb],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  protected readonly brand = BRAND;
  private readonly repo = inject(DashboardRepository);
  protected readonly summary = createLoader(() => this.repo.summary());

  protected readonly shortcuts: Shortcut[] = [
    { label: 'บันทึกยอดขาย', path: '/sales', icon: 'bag' },
    { label: 'รายรับ-รายจ่าย', path: '/money', icon: 'wallet' },
    { label: 'ดูสต็อก', path: '/stock', icon: 'package' },
    { label: 'คำนวณต้นทุน', path: '/cost', icon: 'calculator' },
  ];

  protected readonly greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return 'อรุณสวัสดิ์ค่ะ';
    if (h < 17) return 'สวัสดีค่ะ';
    return 'สวัสดีตอนเย็นค่ะ';
  })();
}
