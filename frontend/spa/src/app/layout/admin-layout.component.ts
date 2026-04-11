import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService, AuthUser } from '../auth.service';
import { RefreshService } from '../refresh.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { BffApiService } from '../api/bff-api.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <section class="admin-shell">
      <header class="admin-topbar">
        <div class="admin-brand">
          <svg class="admin-brand__logo" viewBox="0 0 48 48" role="img" aria-hidden="true">
            <path
              d="M24 4C18 14 12 20 12 30c0 8 5 14 12 14s12-6 12-14C36 20 30 14 24 4Z"
              fill="rgba(255,255,255,0.92)"
            />
            <path
              d="M18 31l7-7 5 5"
              fill="none"
              stroke="rgba(0,0,0,0.20)"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle cx="18" cy="31" r="2.6" fill="rgba(0,0,0,0.18)" />
            <circle cx="25" cy="24" r="2.6" fill="rgba(0,0,0,0.18)" />
            <circle cx="30" cy="29" r="2.6" fill="rgba(0,0,0,0.18)" />
          </svg>
          <span class="admin-brand__text">GEstiDlo</span>
        </div>

        <div class="admin-topbar__search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M10.5 3a7.5 7.5 0 1 1 4.65 13.38l4.24 4.24-1.41 1.41-4.24-4.24A7.5 7.5 0 0 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
              fill="currentColor"
            />
          </svg>
          <input class="admin-topbar__search-input" type="search" [placeholder]="('dashboard.admin.search' | t)" />
        </div>

        <div class="admin-topbar__right">
          <div class="admin-topbar__period">
            <span class="admin-topbar__period-label">{{ 'dashboard.admin.period' | t }}:</span>
            <select [(ngModel)]="period" class="admin-topbar__period-select">
              <option value="30d">{{ 'dashboard.admin.period.30d' | t }}</option>
              <option value="7d">{{ 'dashboard.admin.period.7d' | t }}</option>
              <option value="90d">{{ 'dashboard.admin.period.90d' | t }}</option>
            </select>
          </div>

          <button type="button" class="admin-icon-btn" [title]="('nav.alerts' | t)" (click)="refreshNow()">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 22a2.5 2.5 0 0 0 2.45-2H9.55A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5L3 18v1h18v-1l-2-2Z"
                fill="currentColor"
              />
            </svg>
            <span class="admin-badge" *ngIf="criticalAlertsCount">{{ criticalAlertsCount }}</span>
          </button>

          <details class="admin-user" #userMenu>
            <summary class="admin-user__trigger">
              <span class="admin-user__name">{{ user?.username || 'admin' }}</span>
              <span class="admin-user__avatar">{{ userInitials() }}</span>
              <svg class="admin-user__caret" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </summary>
            <div class="admin-user__panel">
              <button type="button" class="admin-user__item" (click)="logout()">{{ 'nav.logout' | t }}</button>
            </div>
          </details>
        </div>
      </header>

      <section class="admin-dash">
        <aside class="admin-dash__sidebar" aria-label="Admin navigation">
          <nav class="admin-nav">
            <a routerLink="/dashboard" routerLinkActive="active">
              <span class="admin-nav__icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 4h8v8H3V4Zm10 0h8v5h-8V4ZM3 14h8v6H3v-6Zm10-3h8v9h-8v-9Z" fill="currentColor" />
                </svg>
              </span>
              <span>{{ 'nav.dashboard' | t }}</span>
            </a>
            <a routerLink="/supervision" routerLinkActive="active">
              <span class="admin-nav__icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span>{{ 'nav.cartography' | t }}</span>
            </a>
            <a routerLink="/resources" routerLinkActive="active">
              <span class="admin-nav__icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C8 7 6 10 6 14a6 6 0 0 0 12 0c0-4-2-7-6-12Z" fill="currentColor" />
                </svg>
              </span>
              <span>{{ 'nav.resources' | t }}</span>
            </a>
            <a routerLink="/infrastructures" routerLinkActive="active">
              <span class="admin-nav__icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 21V3h16v18H4Zm4-11h3V7H8v3Zm0 7h3v-3H8v3Zm5-7h3V7h-3v3Zm0 7h3v-3h-3v3Z" fill="currentColor" />
                </svg>
              </span>
              <span>{{ 'nav.infrastructure' | t }}</span>
            </a>
            <a routerLink="/service" routerLinkActive="active">
              <span class="admin-nav__icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 6V3L8 7l4 4V8c2.76 0 5 2.24 5 5a5 5 0 0 1-9.58 2H5.26A7 7 0 0 0 19 13c0-3.87-3.13-7-7-7Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span>{{ 'nav.service' | t }}</span>
            </a>
            <a routerLink="/quality" routerLinkActive="active">
              <span class="admin-nav__icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1 14-4-4 1.41-1.41L11 13.17l6.59-6.58L19 8l-8 8Z" fill="currentColor" />
                </svg>
              </span>
              <span>{{ 'nav.quality' | t }}</span>
            </a>
            <a routerLink="/alerts" routerLinkActive="active">
              <span class="admin-nav__icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2 1 21h22L12 2Zm1 15h-2v-2h2v2Zm0-4h-2V9h2v4Z" fill="currentColor" />
                </svg>
              </span>
              <span>{{ 'nav.alerts' | t }}</span>
            </a>
            <a routerLink="/traceability" routerLinkActive="active">
              <span class="admin-nav__icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M13 3a9 9 0 1 0 8.95 10h-2.06A7 7 0 1 1 13 5v4l5-5-5-5v4Z" fill="currentColor" />
                </svg>
              </span>
              <span>{{ 'nav.traceability' | t }}</span>
            </a>
            <a routerLink="/reports" routerLinkActive="active">
              <span class="admin-nav__icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 2h12v5H6V2Zm12 8h1a3 3 0 0 1 3 3v5h-4v4H6v-4H2v-5a3 3 0 0 1 3-3h1v3h12v-3ZM8 20h8v-5H8v5Z" fill="currentColor" />
                </svg>
              </span>
              <span>{{ 'nav.reports' | t }}</span>
            </a>
            <a routerLink="/governance" routerLinkActive="active">
              <span class="admin-nav__icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4Zm0 10.2 5.2-2.6v2.9L12 14l-5.2-2.5V8.6l5.2 2.6Z" fill="currentColor" />
                </svg>
              </span>
              <span>{{ 'nav.governance' | t }}</span>
            </a>
            <a routerLink="/administration" routerLinkActive="active">
              <span class="admin-nav__icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 7.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.41 1.05.73 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96c.23.1.5 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span>{{ 'nav.administration' | t }}</span>
            </a>
          </nav>
        </aside>

        <main class="admin-dash__content">
          <router-outlet></router-outlet>
        </main>
      </section>
    </section>
  `
})
export class AdminLayoutComponent implements OnDestroy {
  @ViewChild('userMenu')
  private readonly userMenu?: ElementRef<HTMLDetailsElement>;

  user: AuthUser | null = null;
  private userSub?: Subscription;
  private refreshSub?: Subscription;

  criticalAlertsCount = 0;
  period: '7d' | '30d' | '90d' = '30d';

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly refresh: RefreshService,
    private readonly api: BffApiService
  ) {
    this.user = this.auth.userSnapshot();
    this.userSub = this.auth.userStream().subscribe((u) => (this.user = u));

    this.refreshSub = this.refresh.refresh$.subscribe(() => this.loadCriticalAlerts());
    this.loadCriticalAlerts();
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  refreshNow() {
    this.refresh.trigger('manual');
  }

  userInitials(): string {
    const u = (this.user?.username ?? 'A').trim();
    return u ? u.slice(0, 1).toUpperCase() : 'A';
  }

  private loadCriticalAlerts() {
    this.api.alerts('ACTIVE').subscribe({
      next: (rows: any) => {
        const list = Array.isArray(rows) ? rows : [];
        this.criticalAlertsCount = list.filter((a) => a?.severity === 'CRIT').length;
      },
      error: () => {
        this.criticalAlertsCount = 0;
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as Node | null;
    if (!target) return;
    if (this.userMenu?.nativeElement.open && !this.userMenu.nativeElement.contains(target)) {
      this.userMenu.nativeElement.open = false;
    }
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.refreshSub?.unsubscribe();
  }
}
