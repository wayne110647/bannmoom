import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MORE_NAV } from '../../layout/nav';
import { Icon } from '../../shared/icon';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-more-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, PageHeader],
  template: `
    <app-page-header title="เพิ่มเติม" />
    <ul class="card divide-y divide-line">
      @for (item of items; track item.path) {
        <li>
          <a [routerLink]="item.path" class="flex min-h-16 items-center gap-4 px-4 active:bg-soft/50">
            <span class="flex size-11 items-center justify-center rounded-xl bg-soft text-primary">
              <app-icon [name]="item.icon" [size]="22" />
            </span>
            <span class="flex-1 font-normal">{{ item.label }}</span>
            @if (item.comingSoon) { <span class="badge-neutral">เร็ว ๆ นี้</span> }
            <app-icon name="chevron-right" [size]="18" class="text-muted" />
          </a>
        </li>
      }
    </ul>
  `,
})
export class MorePage {
  protected readonly items = MORE_NAV;
}
