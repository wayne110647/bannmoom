import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from '../../shared/page-header';
import { EmptyState } from '../../shared/states';

/** Placeholder for features planned in later phases. Receives `heading` from route data. */
@Component({
  selector: 'app-coming-soon-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageHeader, EmptyState],
  template: `
    <app-page-header [title]="heading()" />
    <app-empty-state icon="heart" title="กำลังเตรียมฟีเจอร์นี้อยู่นะคะ" detail="หน้านี้จะเปิดใช้งานในเวอร์ชันถัดไป">
      <a routerLink="/" class="btn-secondary">กลับหน้าแรก</a>
    </app-empty-state>
  `,
})
export class ComingSoonPage {
  heading = input('เร็ว ๆ นี้');
}
