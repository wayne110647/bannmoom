import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { BRAND } from '../core/brand';
import { usingMockData } from '../core/data/data-providers';
import { OnlineStatus } from '../core/online-status';
import { Icon } from '../shared/icon';
import { ActionSheet } from '../shared/action-sheet';
import { Toasts } from '../shared/toast';
import { MAIN_NAV, MORE_NAV, SIDEBAR_LABEL } from './nav';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Toasts, ActionSheet],
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly brand = BRAND;
  protected readonly mainNav = MAIN_NAV;
  protected readonly moreNav = MORE_NAV;
  protected readonly sidebarLabel = SIDEBAR_LABEL;
  protected readonly usingMockData = usingMockData;
  protected readonly online = inject(OnlineStatus).online;
  protected readonly moreOpen = signal(true);

  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );

  /** The "เพิ่มเติม" tab is active for /more and every page listed inside it. */
  protected moreActive = () => {
    const url = this.url();
    return url.startsWith('/more') || MORE_NAV.some((n) => url.startsWith(n.path));
  };
}
