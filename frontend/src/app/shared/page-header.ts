import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';

@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon],
  host: { class: 'mb-5 flex items-start gap-2' },
  template: `
    @if (backLink()) {
      <a [routerLink]="backLink()" class="icon-btn -ml-2 shrink-0" aria-label="ย้อนกลับ">
        <app-icon name="chevron-left" [size]="22" />
      </a>
    }
    <div class="min-w-0 flex-1">
      <h1 class="truncate text-xl font-medium text-primary-dark sm:text-2xl">{{ title() }}</h1>
      @if (subtitle()) {
        <p class="mt-0.5 text-sm text-muted">{{ subtitle() }}</p>
      }
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <ng-content />
    </div>
  `,
})
export class PageHeader {
  title = input.required<string>();
  subtitle = input<string>();
  backLink = input<string | unknown[]>();
}
