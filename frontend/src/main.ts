import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/** The splash in index.html stays at least this long after the page starts loading. */
const SPLASH_MIN_MS = 2000;

function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  setTimeout(() => {
    splash.classList.add('splash-out');
    setTimeout(() => splash.remove(), 500);
  }, Math.max(0, SPLASH_MIN_MS - performance.now()));
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err))
  .finally(hideSplash);
