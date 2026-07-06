import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
<div class="ll">

  <!-- ── NAV ────────────────────────────────────────────── -->
  <nav class="ll-nav">
    <a class="ll-brand" routerLink="/">
      <span class="ll-brand-dot"></span>
      <span>GEstiDlo</span>
    </a>
    <div class="ll-nav-right">
      <span class="ll-nav-hint">Pas encore de compte&nbsp;?</span>
      <a class="ll-nav-btn" routerLink="/">S'inscrire</a>
    </div>
  </nav>

  <!-- ── CARD ───────────────────────────────────────────── -->
  <main class="ll-main">
    <div class="ll-orb ll-orb--1"></div>
    <div class="ll-orb ll-orb--2"></div>

    <div class="ll-card">

      <!-- lock icon -->
      <div class="ll-lock-wrap">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
          <path d="M17 11V7A5 5 0 0 0 7 7v4M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z"
            stroke="white" stroke-width="2" stroke-linecap="round" fill="none"/>
        </svg>
      </div>

      <h1 class="ll-title">Portail de supervision</h1>
      <p class="ll-sub">Connectez-vous pour accéder à votre espace GESTiDlo</p>

      <!-- error banner -->
      <div class="ll-error" *ngIf="errorMsg" role="alert" [class.ll-error--shake]="shake">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
        </svg>
        {{ errorMsg }}
      </div>

      <!-- form -->
      <form class="ll-form" (ngSubmit)="submit()" novalidate>

        <div class="ll-field">
          <label class="ll-label" for="ll-email">Email ou nom d'utilisateur</label>
          <div class="ll-input-wrap">
            <svg class="ll-input-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
            <input
              id="ll-email"
              class="ll-input"
              type="text"
              [(ngModel)]="email"
              name="email"
              placeholder="ex. klove ou klove@dinepa.com"
              autocomplete="username"
              [disabled]="loading"
            />
          </div>
        </div>

        <div class="ll-field">
          <div class="ll-label-row">
            <label class="ll-label" for="ll-password">Mot de passe</label>
            <a class="ll-forgot" routerLink="/">Oublié&nbsp;?</a>
          </div>
          <div class="ll-input-wrap">
            <svg class="ll-input-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M17 11V7A5 5 0 0 0 7 7v4M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z"
                stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
            </svg>
            <input
              id="ll-password"
              class="ll-input ll-input--pwd"
              [type]="showPwd ? 'text' : 'password'"
              [(ngModel)]="password"
              name="password"
              placeholder="••••••••••••"
              autocomplete="current-password"
              [disabled]="loading"
            />
            <button
              class="ll-eye"
              type="button"
              (click)="showPwd = !showPwd"
              [attr.aria-label]="showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
            >
              <!-- eye open -->
              <svg *ngIf="!showPwd" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.8" fill="none"/>
                <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" fill="none"/>
              </svg>
              <!-- eye slash -->
              <svg *ngIf="showPwd" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>
              </svg>
            </button>
          </div>
        </div>

        <label class="ll-check">
          <input type="checkbox" [(ngModel)]="rememberMe" name="rememberMe" [disabled]="loading" />
          <span class="ll-checkmark"></span>
          <span class="ll-check-label">Garder ma session ouverte</span>
        </label>

        <button class="ll-submit" type="submit" [disabled]="loading || !email || !password">
          <span *ngIf="!loading">Se connecter &nbsp;→</span>
          <span *ngIf="loading" class="ll-spinner-wrap">
            <span class="ll-spinner"></span>
            Connexion…
          </span>
        </button>

      </form>

      <!-- divider -->
      <div class="ll-divider"><span>OU</span></div>

      <!-- social -->
      <div class="ll-social">
        <button class="ll-social-btn" type="button" disabled title="Bientôt disponible">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </button>
        <button class="ll-social-btn" type="button" disabled title="Bientôt disponible">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" fill="currentColor"/>
          </svg>
          GitHub
        </button>
      </div>

      <!-- demo accounts -->
      <div class="ll-demo" [class.ll-demo--open]="demoOpen">
        <button class="ll-demo-toggle" type="button" (click)="demoOpen = !demoOpen">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.8" fill="none"/>
            <path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
          </svg>
          <span>Comptes démo disponibles</span>
          <svg class="ll-demo-caret" [class.ll-demo-caret--open]="demoOpen" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
          </svg>
        </button>
        <div class="ll-demo-accounts" *ngIf="demoOpen">
          <button
            *ngFor="let d of demos"
            class="ll-demo-account"
            type="button"
            (click)="fillDemo(d)"
          >
            <span class="ll-demo-name">{{ d.label }}</span>
            <span class="ll-demo-role">{{ d.role }}</span>
          </button>
        </div>
      </div>

      <!-- footer -->
      <p class="ll-tls">Protégé par chiffrement TLS &nbsp;·&nbsp; <strong>Conforme RGPD</strong></p>

    </div><!-- /ll-card -->
  </main>

</div>
  `,
  styles: [`
    /* ─── ROOT ─────────────────────────────────────────── */
    .ll {
      min-height: 100vh;
      background: #0A0E1A;
      color: #E2E8F0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
    }

    /* ─── NAV ──────────────────────────────────────────── */
    .ll-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.5rem;
      height: 60px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      background: rgba(10,14,26,0.8);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .ll-brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 700;
      font-size: 1.1rem;
      color: #E2E8F0;
      text-decoration: none;
      letter-spacing: -0.02em;
    }
    .ll-brand-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #00D4FF;
      box-shadow: 0 0 8px #00D4FF;
    }
    .ll-nav-right {
      display: flex;
      align-items: center;
      gap: 0.875rem;
    }
    .ll-nav-hint {
      font-size: 0.875rem;
      color: #64748B;
    }
    .ll-nav-btn {
      padding: 0.4rem 1rem;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
      color: #E2E8F0;
      text-decoration: none;
      transition: border-color 0.2s, background 0.2s;
    }
    .ll-nav-btn:hover { border-color: rgba(255,255,255,0.35); background: rgba(255,255,255,0.05); }

    /* ─── MAIN / ORB ────────────────────────────────────── */
    .ll-main {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2.5rem 1rem 3rem;
      position: relative;
      overflow: hidden;
    }
    .ll-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(90px);
      pointer-events: none;
    }
    .ll-orb--1 {
      width: 500px; height: 500px;
      background: rgba(0, 85, 255, 0.12);
      top: -150px; left: -180px;
    }
    .ll-orb--2 {
      width: 380px; height: 380px;
      background: rgba(139, 92, 246, 0.1);
      bottom: -120px; right: -120px;
    }

    /* ─── CARD ──────────────────────────────────────────── */
    .ll-card {
      position: relative;
      z-index: 2;
      width: 100%;
      max-width: 460px;
      background: rgba(17, 24, 39, 0.85);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 20px;
      padding: 2.25rem 2rem 1.75rem;
      box-shadow:
        0 25px 60px rgba(0,0,0,0.4),
        0 0 0 1px rgba(0, 212, 255, 0.04);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }

    /* lock icon */
    .ll-lock-wrap {
      width: 60px; height: 60px;
      border-radius: 16px;
      background: linear-gradient(135deg, #3B82F6, #8B5CF6);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
      box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
    }

    .ll-title {
      font-size: 1.75rem;
      font-weight: 800;
      color: #F1F5F9;
      text-align: center;
      margin: 0 0 0.5rem;
      letter-spacing: -0.03em;
    }
    .ll-sub {
      font-size: 0.875rem;
      color: #64748B;
      text-align: center;
      margin: 0 0 1.75rem;
      line-height: 1.5;
    }

    /* error banner */
    .ll-error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #FCA5A5;
      border-radius: 10px;
      padding: 0.7rem 0.875rem;
      font-size: 0.83rem;
      font-weight: 500;
      margin-bottom: 1.25rem;
    }
    .ll-error--shake { animation: ll-shake 0.4s ease; }
    @keyframes ll-shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-6px); }
      40% { transform: translateX(6px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }

    /* ─── FORM ──────────────────────────────────────────── */
    .ll-form { display: flex; flex-direction: column; gap: 1rem; }

    .ll-field { display: flex; flex-direction: column; gap: 0.45rem; }

    .ll-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .ll-label {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #94A3B8;
    }
    .ll-forgot {
      font-size: 0.8rem;
      font-weight: 500;
      color: #60A5FA;
      text-decoration: none;
      transition: color 0.15s;
    }
    .ll-forgot:hover { color: #93C5FD; }

    .ll-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .ll-input-icon {
      position: absolute;
      left: 0.875rem;
      color: #475569;
      pointer-events: none;
      flex-shrink: 0;
    }
    .ll-input {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 0.8rem 0.875rem 0.8rem 2.75rem;
      font-size: 0.95rem;
      color: #F1F5F9;
      outline: none;
      transition: border-color 0.2s, background 0.2s;
      font-family: inherit;
    }
    .ll-input::placeholder { color: #334155; }
    .ll-input:focus {
      border-color: rgba(96, 165, 250, 0.5);
      background: rgba(255,255,255,0.07);
    }
    .ll-input:disabled { opacity: 0.55; cursor: not-allowed; }
    .ll-input--pwd { padding-right: 2.75rem; }

    .ll-eye {
      position: absolute;
      right: 0.75rem;
      background: none;
      border: none;
      padding: 0.25rem;
      cursor: pointer;
      color: #475569;
      display: flex;
      align-items: center;
      transition: color 0.15s;
    }
    .ll-eye:hover { color: #94A3B8; }

    /* custom checkbox */
    .ll-check {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      cursor: pointer;
      user-select: none;
    }
    .ll-check input[type="checkbox"] { display: none; }
    .ll-checkmark {
      width: 18px; height: 18px;
      border: 1.5px solid rgba(255,255,255,0.2);
      border-radius: 5px;
      background: rgba(255,255,255,0.05);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s, border-color 0.15s;
    }
    .ll-check input:checked ~ .ll-checkmark {
      background: #3B82F6;
      border-color: #3B82F6;
    }
    .ll-check input:checked ~ .ll-checkmark::after {
      content: '';
      display: block;
      width: 10px; height: 6px;
      border-left: 2px solid #fff;
      border-bottom: 2px solid #fff;
      transform: translateY(-1px) rotate(-45deg);
    }
    .ll-check-label { font-size: 0.875rem; color: #94A3B8; }

    /* submit */
    .ll-submit {
      width: 100%;
      padding: 0.9rem;
      background: #F8FAFC;
      color: #0F172A;
      border: none;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.15s;
      margin-top: 0.25rem;
      letter-spacing: 0.01em;
    }
    .ll-submit:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
    .ll-submit:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
    .ll-spinner-wrap { display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
    .ll-spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(0,0,0,0.15);
      border-top-color: #0F172A;
      border-radius: 50%;
      animation: ll-spin 0.6s linear infinite;
    }
    @keyframes ll-spin { to { transform: rotate(360deg); } }

    /* ─── DIVIDER ───────────────────────────────────────── */
    .ll-divider {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 1.25rem 0;
      color: #334155;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.08em;
    }
    .ll-divider::before, .ll-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(255,255,255,0.07);
    }

    /* ─── SOCIAL ────────────────────────────────────────── */
    .ll-social {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }
    .ll-social-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.7rem;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 600;
      color: #E2E8F0;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
    }
    .ll-social-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); }
    .ll-social-btn:disabled { opacity: 0.45; cursor: not-allowed; }

    /* ─── DEMO ACCOUNTS ─────────────────────────────────── */
    .ll-demo {
      border: 1px solid rgba(251, 191, 36, 0.25);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 1.25rem;
    }
    .ll-demo-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.7rem 0.875rem;
      background: rgba(251, 191, 36, 0.07);
      border: none;
      cursor: pointer;
      font-size: 0.83rem;
      font-weight: 600;
      color: #FBBF24;
      text-align: left;
    }
    .ll-demo-toggle span { flex: 1; }
    .ll-demo-caret {
      color: #FBBF24;
      transition: transform 0.2s;
    }
    .ll-demo-caret--open { transform: rotate(180deg); }
    .ll-demo-accounts {
      display: flex;
      flex-direction: column;
      border-top: 1px solid rgba(251, 191, 36, 0.15);
    }
    .ll-demo-account {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 0.875rem;
      background: none;
      border: none;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      cursor: pointer;
      transition: background 0.15s;
      text-align: left;
    }
    .ll-demo-account:last-child { border-bottom: none; }
    .ll-demo-account:hover { background: rgba(255,255,255,0.04); }
    .ll-demo-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: #E2E8F0;
      font-family: ui-monospace, 'Cascadia Code', monospace;
    }
    .ll-demo-role {
      font-size: 0.7rem;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: rgba(255,255,255,0.06);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
    }

    /* ─── TLS FOOTER ────────────────────────────────────── */
    .ll-tls {
      font-size: 0.72rem;
      color: #334155;
      text-align: center;
      margin: 0;
    }
    .ll-tls strong { font-weight: 600; color: #475569; }

    /* ─── RESPONSIVE ────────────────────────────────────── */
    @media (max-width: 500px) {
      .ll-card { padding: 1.75rem 1.25rem 1.5rem; }
      .ll-title { font-size: 1.5rem; }
      .ll-nav-hint { display: none; }
    }
  `]
})
export class LoginPageComponent {
  email = '';
  password = '';
  showPwd = false;
  rememberMe = true;
  loading = false;
  errorMsg: string | null = null;
  shake = false;
  demoOpen = false;

  readonly demos = [
    { label: 'admin@dinepa.ht',       email: 'admin@dinepa.ht',       password: 'admin',       role: 'Admin' },
    { label: 'superviseur@dinepa.ht', email: 'superviseur@dinepa.ht', password: 'superviseur', role: 'Responsable URD' },
    { label: 'tech@dinepa.ht',        email: 'tech@dinepa.ht',        password: 'tech',        role: 'Tech' },
  ];

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  fillDemo(d: { email: string; password: string }): void {
    this.email = d.email;
    this.password = d.password;
    this.demoOpen = false;
  }

  submit(): void {
    if (!this.email.trim() || !this.password) return;
    this.loading = true;
    this.errorMsg = null;
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: () => {
        this.loading = false;
        // Chaque rôle vers son propre shell (même logique que homeFor() des routes) :
        // un TEPAC va directement sur /terrain au lieu de rebondir par /admin.
        const dest =
          this.auth.hasRole('SUPERVISEUR_URD') ? '/superviseur/tableau-de-bord' :
          this.auth.hasRole('TEPAC')           ? '/terrain/tableau-de-bord' :
                                                 '/admin/dashboard';
        this.router.navigateByUrl(dest);
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg =
          err?.error?.message ??
          err?.error?.detail ??
          err?.error?.error ??
          'Identifiants incorrects. Vérifiez vos accès.';
        this.shake = true;
        setTimeout(() => (this.shake = false), 500);
      }
    });
  }
}
