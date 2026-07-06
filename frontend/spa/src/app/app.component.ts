import { Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from './theme.service';
import { I18nService } from './i18n/i18n.service';
import { TranslatePipe } from './i18n/translate.pipe';
import { Locale, supportedLocales } from './i18n/translations';
import { FormsModule } from '@angular/forms';
import { ToastContainerComponent } from './ui/toast-container.component';
import { RefreshService } from './refresh.service';
import { AuthService, AuthUser } from './auth.service';
import { AlertStore } from './alert.store';
import { Subscription, filter } from 'rxjs';
import { NavigationError, Router } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, ToastContainerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnDestroy {
  title = 'spa';

  @ViewChild('toolsMenu')
  private readonly toolsMenu?: ElementRef<HTMLDetailsElement>;

  @ViewChild('userMenu')
  private readonly userMenu?: ElementRef<HTMLDetailsElement>;

  readonly locales = supportedLocales;

  autoRefresh = true;
  private readonly autoRefreshKey = 'gestidlo.autoRefresh';
  private refreshInterval?: number;

  user: AuthUser | null = null;
  private userSubscription?: Subscription;

  constructor(
    private readonly theme: ThemeService,
    private readonly i18n: I18nService,
    private readonly refresh: RefreshService,
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly alertStore: AlertStore,
  ) {
    this.theme.init();
    this.i18n.init();

    this.autoRefresh = this.loadAutoRefresh();
    this.applyAutoRefresh();

    // Communes sans TEPAC connues statiquement — Carrefour est le cas documenté
    const COMMUNES_SANS_TEPAC = new Set(['Carrefour']);
    this.alertStore.checkAndEscalate(commune => !COMMUNES_SANS_TEPAC.has(commune));

    this.user = this.auth.userSnapshot();
    this.userSubscription = this.auth.userStream().subscribe((u) => (this.user = u));

    // Auto-guérison des chunks périmés : après un rebuild du conteneur spa, un onglet
    // resté ouvert garde en mémoire les anciens noms de chunks hashés. Le lazy-load d'une
    // page échoue alors sur un 404 ("Failed to fetch dynamically imported module"). On
    // recharge une seule fois (garde anti-boucle : pas de rechargement si on vient déjà
    // d'en faire un < 10 s, sinon un déploiement réellement cassé bouclerait à l'infini).
    this.chunkErrorSubscription = this.router.events
      .pipe(filter((e): e is NavigationError => e instanceof NavigationError))
      .subscribe((e) => this.handleNavigationError(e));
  }

  private chunkErrorSubscription?: Subscription;

  private handleNavigationError(event: NavigationError): void {
    const message = String(event?.error?.message ?? '');
    const isChunkError =
      message.includes('dynamically imported module') ||
      message.includes('Loading chunk') ||
      message.includes('Importing a module script failed');
    if (!isChunkError) {
      return;
    }
    const key = 'gestidlo.chunkReloadAt';
    const last = Number(sessionStorage.getItem(key) ?? '0');
    if (Date.now() - last < 10000) {
      // On vient déjà de recharger : le chunk manque vraiment (déploiement cassé). On n'insiste pas.
      console.error('Chunk introuvable après rechargement — build incohérent ?', event.error);
      return;
    }
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }

  get isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  get isAdmin(): boolean {
    return this.auth.hasRole('ADMIN');
  }

  get isLoginPage(): boolean {
    return this.router.url.startsWith('/login');
  }

  get isLandingPage(): boolean {
    return this.router.url === '/';
  }

  get isPublicPage(): boolean {
    return this.isLandingPage || this.isLoginPage;
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  closeMenus() {
    if (this.toolsMenu?.nativeElement.open) {
      this.toolsMenu.nativeElement.open = false;
    }
    if (this.userMenu?.nativeElement.open) {
      this.userMenu.nativeElement.open = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as Node | null;
    if (!target) {
      return;
    }

    if (this.toolsMenu?.nativeElement.open && !this.toolsMenu.nativeElement.contains(target)) {
      this.toolsMenu.nativeElement.open = false;
    }
    if (this.userMenu?.nativeElement.open && !this.userMenu.nativeElement.contains(target)) {
      this.userMenu.nativeElement.open = false;
    }
  }

  private loadAutoRefresh(): boolean {
    const raw = localStorage.getItem(this.autoRefreshKey);
    return raw === null ? true : raw === 'true';
  }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    localStorage.setItem(this.autoRefreshKey, String(this.autoRefresh));
    this.applyAutoRefresh();
  }

  private applyAutoRefresh() {
    if (this.refreshInterval) {
      window.clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }
    if (!this.autoRefresh) {
      return;
    }
    this.refreshInterval = window.setInterval(() => this.refresh.trigger('auto'), 30000);
  }

  get isDark(): boolean {
    return this.theme.current() === 'dark';
  }

  toggleTheme() {
    this.theme.toggle();
  }

  get locale(): Locale {
    return this.i18n.getLocale();
  }

  setLocale(locale: Locale) {
    this.i18n.setLocale(locale);
  }

  refreshNow() {
    this.refresh.trigger('manual');
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      window.clearInterval(this.refreshInterval);
    }
    this.userSubscription?.unsubscribe();
    this.chunkErrorSubscription?.unsubscribe();
  }
}
