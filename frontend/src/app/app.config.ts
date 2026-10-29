import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, Injectable, provideBrowserGlobalErrorListeners } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy, provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { BRAND } from './core/brand';
import { provideDataLayer } from './core/data/data-providers';

@Injectable({ providedIn: 'root' })
class BrandTitleStrategy extends TitleStrategy {
  constructor(private readonly title: Title) { super(); }
  override updateTitle(snapshot: RouterStateSnapshot) {
    const page = this.buildTitle(snapshot);
    this.title.setTitle(page ? `${page} · ${BRAND.shortName}` : BRAND.name);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(withFetch()),
    { provide: TitleStrategy, useClass: BrandTitleStrategy },
    ...provideDataLayer(),
  ],
};
