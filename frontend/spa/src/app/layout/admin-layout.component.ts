import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';

import { AuthService, AuthUser } from '../auth.service';
import { RefreshService } from '../refresh.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { BffApiService } from '../api/bff-api.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  styles: [`
    /* ═══════════════════════════════════════════════════════════
       TOPBAR — ELEMENTS PREMIUM
    ═══════════════════════════════════════════════════════════ */

    /* Groupes left / right */
    .tb-left  { display:flex; align-items:center; gap:.9rem; flex-shrink:0; }
    .tb-right { display:flex; align-items:center; gap:.6rem; flex-shrink:0; margin-left:auto; }

    /* Separateur vertical */
    .tb-sep { width:1px; height:26px; background:rgba(255,255,255,.1); flex-shrink:0; }

    /* ── 0. SIDEBAR TOGGLE (dans topbar) ───────────────────── */
    .tb-sb-toggle {
      width:38px; height:38px; border:0; border-radius:10px;
      background:rgba(255,255,255,.08);
      border:1px solid rgba(255,255,255,.1);
      color:rgba(255,255,255,.7); cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0; transition:background .15s,color .15s;
    }
    .tb-sb-toggle:hover { background:rgba(255,255,255,.15); color:#fff; }

    /* ── 1. IDENTITE ────────────────────────────────────────── */
    .tb-identity { display:flex; align-items:center; gap:.75rem; }
    .tb-logo {
      width:46px; height:46px; border-radius:50%;
      background:rgba(255,255,255,.12);
      border:2px solid rgba(255,255,255,.22);
      box-shadow:0 0 0 4px rgba(76,227,196,.18), 0 4px 16px rgba(0,0,0,.25);
      display:flex; align-items:center; justify-content:center;
      overflow:hidden; flex-shrink:0;
    }
    .tb-logo img { width:32px; height:32px; object-fit:contain; }
    .tb-brand { display:flex; flex-direction:column; gap:.04rem; }
    .tb-brand-name {
      font-size:.95rem; font-weight:900; letter-spacing:.05em;
      color:#fff; white-space:nowrap; line-height:1;
    }
    .tb-brand-accent { color:#4ce3c4; }
    .tb-brand-sub {
      font-size:.66rem; color:rgba(255,255,255,.42); font-weight:500;
      white-space:nowrap; letter-spacing:.01em;
    }

    /* ── 2. CONTEXTE PAGE ───────────────────────────────────── */
    .tb-context { display:flex; flex-direction:column; gap:.04rem; flex-shrink:0; }
    .tb-context-name {
      font-size:.86rem; font-weight:700; color:rgba(255,255,255,.92);
      white-space:nowrap; line-height:1.2;
    }
    .tb-context-sub {
      font-size:.67rem; color:rgba(255,255,255,.35); font-weight:400;
      white-space:nowrap;
    }

    /* ── 3. RECHERCHE ───────────────────────────────────────── */
    .tb-search {
      flex:1; min-width:0; max-width:400px; margin:0 auto;
      display:flex; align-items:center; gap:.5rem;
      background:rgba(255,255,255,.08);
      border:1px solid rgba(255,255,255,.1);
      border-radius:10px; padding:0 .85rem; height:38px;
      transition:background .15s, border-color .2s;
    }
    .tb-search:focus-within {
      background:rgba(255,255,255,.13);
      border-color:rgba(76,227,196,.35);
      box-shadow:0 0 0 3px rgba(76,227,196,.1);
    }
    .tb-search-icon { color:rgba(255,255,255,.38); flex-shrink:0; }
    .tb-search-input {
      flex:1; border:0; outline:none; background:transparent;
      font-size:.845rem; color:#fff; min-width:0; padding:0;
    }
    .tb-search-input::placeholder { color:rgba(255,255,255,.32); }
    .tb-search-kbd {
      display:inline-flex; align-items:center; gap:.18rem;
      font-size:.6rem; font-weight:700; font-family:inherit;
      color:rgba(255,255,255,.28);
      background:rgba(255,255,255,.07);
      border:1px solid rgba(255,255,255,.1);
      border-radius:5px; padding:.1rem .35rem;
      white-space:nowrap; flex-shrink:0; letter-spacing:.02em;
    }

    /* ── 4. PERIODE ─────────────────────────────────────────── */
    .tb-period {
      display:flex; align-items:center; gap:.38rem; flex-shrink:0;
      padding:.42rem .7rem;
      background:rgba(255,255,255,.07);
      border:1px solid rgba(255,255,255,.1);
      border-radius:9px;
      transition:background .15s;
    }
    .tb-period:hover { background:rgba(255,255,255,.12); }
    .tb-period-icon { color:rgba(255,255,255,.5); flex-shrink:0; }
    .tb-period-wrap { position:relative; display:flex; align-items:center; }
    .tb-period-select {
      border:0; outline:none; background:transparent;
      font-size:.8rem; font-weight:700; color:rgba(255,255,255,.88);
      cursor:pointer; appearance:none; padding-right:.95rem;
      white-space:nowrap;
    }
    .tb-period-select option { background:#0b304f; color:#fff; }
    .tb-period-chevron { position:absolute; right:0; pointer-events:none; color:rgba(255,255,255,.38); }

    /* ── 5. NOTIFICATIONS ───────────────────────────────────── */
    .tb-notif {
      position:relative; width:38px; height:38px; border:0;
      background:rgba(255,255,255,.07);
      border:1px solid rgba(255,255,255,.1);
      border-radius:9px; color:rgba(255,255,255,.7);
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      flex-shrink:0; transition:background .15s, color .15s;
    }
    .tb-notif:hover { background:rgba(255,255,255,.14); color:#fff; }
    .tb-notif-badge {
      position:absolute; top:4px; right:4px;
      min-width:16px; height:16px; padding:0 4px;
      background:#ef4444; color:#fff;
      font-size:.58rem; font-weight:800;
      border-radius:999px; border:1.5px solid #0b304f;
      display:flex; align-items:center; justify-content:center; line-height:1;
    }

    /* ── 6. PROFIL ──────────────────────────────────────────── */
    .tb-profile { flex-shrink:0; position:relative; list-style:none; }
    .tb-profile summary { list-style:none; outline:none; }
    .tb-profile summary::-webkit-details-marker { display:none; }
    .tb-profile-trigger {
      display:flex; align-items:center; gap:.5rem;
      padding:.3rem .65rem .3rem .35rem;
      background:rgba(255,255,255,.07);
      border:1px solid rgba(255,255,255,.1);
      border-radius:9px; cursor:pointer;
      transition:background .15s;
    }
    .tb-profile-trigger:hover { background:rgba(255,255,255,.13); }
    .tb-avatar {
      width:30px; height:30px; border-radius:50%;
      background:linear-gradient(135deg,#2563eb,#1d4ed8);
      color:#fff; font-size:.77rem; font-weight:900;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0; letter-spacing:.02em;
    }
    .tb-profile-name {
      font-size:.82rem; font-weight:700; color:rgba(255,255,255,.9);
      white-space:nowrap;
    }
    .tb-profile-caret { color:rgba(255,255,255,.38); }
    /* Dropdown */
    .tb-profile[open] .tb-profile-panel { display:block; }
    .tb-profile-panel {
      display:none; position:absolute; top:calc(100% + .5rem); right:0;
      background:#fff; border-radius:14px;
      box-shadow:0 12px 40px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.1);
      min-width:210px; z-index:500; overflow:hidden;
      border:1px solid rgba(2,6,23,.08); animation:tbPanelIn .14s ease;
    }
    @keyframes tbPanelIn {
      from { opacity:0; transform:translateY(-6px) scale(.97); }
      to   { opacity:1; transform:none; }
    }
    .tb-panel-header {
      display:flex; align-items:center; gap:.7rem;
      padding:.9rem 1rem;
      border-bottom:1px solid rgba(2,6,23,.06);
      background:rgba(2,6,23,.02);
    }
    .tb-panel-avatar {
      width:38px; height:38px; border-radius:50%;
      background:linear-gradient(135deg,#2563eb,#1d4ed8);
      color:#fff; font-size:.92rem; font-weight:900;
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
    }
    .tb-panel-name { font-size:.88rem; font-weight:700; color:#0f172a; line-height:1.2; }
    .tb-panel-role { font-size:.72rem; color:#64748b; font-weight:500; margin-top:.12rem; display:block; }
    .tb-panel-action {
      width:100%; padding:.65rem 1rem; border:0; background:transparent;
      text-align:left; font-size:.84rem; font-weight:600; color:#ef4444;
      cursor:pointer; display:flex; align-items:center; gap:.55rem;
      transition:background .15s;
    }
    .tb-panel-action:hover { background:rgba(239,68,68,.06); }

    /* ═══════════════════════════════════════════════════════════
       SIDEBAR
    ═══════════════════════════════════════════════════════════ */
    .admin-sidebar {
      position:fixed; left:1rem; top:calc(64px + 1rem);
      height:calc(100vh - 64px - 2rem); width:256px;
      z-index:800; display:flex; flex-direction:column;
      background:linear-gradient(160deg,#0d1e38 0%,#112038 55%,#0e1e36 100%);
      border:1px solid rgba(255,255,255,.07); border-radius:16px;
      box-shadow:0 8px 40px rgba(5,12,28,.6),0 2px 8px rgba(5,12,28,.3);
      overflow:hidden; transition:width .28s cubic-bezier(.4,0,.2,1);
    }
    .sb-compact .admin-sidebar { width:60px; }
    .sb-closed  .admin-sidebar { width:0; }

    .admin-sb-identity {
      display:flex; align-items:center; justify-content:space-between;
      padding:1.1rem .9rem .85rem;
      border-bottom:1px solid rgba(255,255,255,.07);
      flex-shrink:0; gap:.5rem; min-width:0;
    }
    .admin-sb-brand { display:flex; align-items:center; gap:.65rem; min-width:0; flex:1; overflow:hidden; }
    .admin-sb-logo {
      width:38px; height:38px; border-radius:50%;
      background:rgba(255,255,255,.12);
      border:2px solid rgba(255,255,255,.15);
      box-shadow:0 0 0 3px rgba(76,227,196,.15);
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0; overflow:hidden;
    }
    .admin-sb-logo img { width:28px; height:28px; object-fit:contain; }
    .admin-sb-brand-text { min-width:0; flex:1; overflow:hidden; }
    .admin-sb-name { display:block; font-size:.88rem; font-weight:900; color:#e2e8f0; letter-spacing:.05em; white-space:nowrap; }
    .admin-sb-accent { color:#60a5fa; }
    .admin-sb-tagline { display:block; font-size:.67rem; color:#3d5a7a; font-weight:500; white-space:nowrap; margin-top:.05rem; }
    .admin-sb-close {
      width:26px; height:26px; border:0;
      background:rgba(255,255,255,.05); border-radius:7px;
      color:#3d5a7a; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0; transition:background .15s,color .15s;
    }
    .admin-sb-close:hover { background:rgba(255,255,255,.12); color:#e2e8f0; }
    .sb-compact .admin-sb-identity  { justify-content:center; padding:.9rem .5rem; }
    .sb-compact .admin-sb-brand     { justify-content:center; }
    .sb-compact .admin-sb-brand-text,
    .sb-compact .admin-sb-close     { display:none; }

    .admin-sb-nav {
      flex:1; overflow-y:auto; overflow-x:hidden; padding:.6rem .5rem;
      scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.08) transparent;
    }
    .admin-sb-nav::-webkit-scrollbar { width:3px; }
    .admin-sb-nav::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:2px; }
    .admin-sb-group-label {
      font-size:.62rem; font-weight:700; letter-spacing:.12em;
      text-transform:uppercase; color:#243d5c;
      padding:.8rem .55rem .28rem; display:block;
      white-space:nowrap; overflow:hidden;
    }
    .sb-compact .admin-sb-group-label {
      height:1px; background:rgba(255,255,255,.06);
      padding:0; margin:.45rem .4rem; font-size:0; overflow:hidden;
    }
    .admin-sb-link {
      display:flex; align-items:center; gap:.65rem;
      padding:.52rem .55rem; border-radius:10px;
      color:#5d85b0; text-decoration:none;
      font-size:.835rem; font-weight:600;
      transition:background .15s,color .15s;
      white-space:nowrap; overflow:hidden;
    }
    .admin-sb-link:hover  { background:rgba(255,255,255,.055); color:#a8c4e0; }
    .admin-sb-link.active { background:rgba(96,165,250,.13);   color:#93c5fd; }
    .admin-sb-icon {
      width:34px; height:34px; border-radius:9px;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0; color:#2e4d6e; transition:color .15s;
    }
    .admin-sb-link:hover  .admin-sb-icon { color:#5d85b0; }
    .admin-sb-link.active .admin-sb-icon { color:#60a5fa; }
    .admin-sb-label { flex:1; white-space:nowrap; overflow:hidden; }
    .admin-sb-badge {
      background:#ef4444; color:#fff; font-size:.65rem; font-weight:800;
      border-radius:999px; padding:.08rem .36rem;
      margin-left:auto; flex-shrink:0; line-height:1.4;
    }
    .sb-compact .admin-sb-link  { justify-content:center; padding:.52rem; gap:0; }
    .sb-compact .admin-sb-label,
    .sb-compact .admin-sb-badge { display:none; }
    .sb-compact .admin-sb-icon  { width:38px; height:38px; }

    .admin-sb-footer { flex-shrink:0; border-top:1px solid rgba(255,255,255,.07); }
    .admin-sb-toggle-row { padding:.48rem .5rem .42rem; border-bottom:1px solid rgba(255,255,255,.05); }
    .admin-sb-toggle {
      display:flex; align-items:center; justify-content:center; gap:.45rem;
      width:100%; padding:.42rem; border:0;
      background:rgba(255,255,255,.04); border-radius:9px;
      color:#2e4d6e; cursor:pointer; font-size:.78rem; font-weight:600;
      transition:background .15s,color .15s;
    }
    .admin-sb-toggle:hover { background:rgba(255,255,255,.09); color:#5d85b0; }
    .sb-compact .admin-sb-toggle-text { display:none; }
    .admin-sb-footer-info {
      padding:.7rem .9rem .8rem;
      display:flex; flex-direction:column; gap:.04rem;
      white-space:nowrap; overflow:hidden;
    }
    .admin-sb-footer-name { font-size:.8rem; font-weight:900; color:#4a6f9c; letter-spacing:.04em; }
    .admin-sb-footer-name span { color:#2563eb; }
    .admin-sb-footer-desc { font-size:.68rem; color:#243d5c; font-weight:500; }
    .admin-sb-footer-ver  { font-size:.62rem; color:#1a2e48; font-weight:600; margin-top:.18rem; letter-spacing:.03em; }
    .sb-compact .admin-sb-footer-info { display:none; }

    .sb-reopen {
      display:none; /* remplacé par tb-sb-toggle dans la topbar */
      position:fixed; left:1rem; top:calc(64px + 1rem);
      z-index:801; width:40px; height:40px; border:0;
      border-radius:12px;
      background:linear-gradient(160deg,#0d1e38,#142440);
      color:#5d85b0; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 4px 16px rgba(5,12,28,.45);
      transition:background .15s,color .15s;
    }
    .sb-reopen:hover { background:#1a3060; color:#93c5fd; }
  `],
  template: `
<section class="admin-shell"
  [class.sb-open]="sbState==='open'"
  [class.sb-compact]="sbState==='compact'"
  [class.sb-closed]="sbState==='closed'">

  <!-- ═══════════════════════════════════════════════════════════
       TOPBAR PREMIUM
  ═══════════════════════════════════════════════════════════ -->
  <header class="admin-topbar">

    <!-- GAUCHE : identité + contexte page -->
    <div class="tb-left">

      <!-- 1. Identité -->
      <div class="tb-identity">
        <div class="tb-logo">
          <img src="assets/logo_gestidlo.png" alt="GEstiDlo" />
        </div>
        <div class="tb-brand">
          <span class="tb-brand-name">GEST<span class="tb-brand-accent">IDLO</span></span>
          <span class="tb-brand-sub">Administration AEP</span>
        </div>
      </div>

      <!-- Toggle sidebar — après le logo/brand -->
      <button class="tb-sb-toggle" type="button"
        (click)="sbState = sbState === 'open' ? 'compact' : sbState === 'compact' ? 'closed' : 'open'"
        [title]="sbState === 'open' ? 'Réduire le menu' : 'Ouvrir le menu'">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="4" y1="6"  x2="20" y2="6"/>
          <line x1="4" y1="12" x2="20" y2="12"/>
          <line x1="4" y1="18" x2="20" y2="18"/>
        </svg>
      </button>

      <!-- 2. Contexte page -->
      <div class="tb-sep" aria-hidden="true"></div>
      <div class="tb-context" *ngIf="currentPageLabel()">
        <span class="tb-context-name">{{ currentPageLabel() }}</span>
        <span class="tb-context-sub">{{ currentPageSubtitle() }}</span>
      </div>

    </div>

    <!-- CENTRE : Recherche -->
    <div class="tb-search">
      <svg class="tb-search-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>
      </svg>
      <input #searchInput class="tb-search-input" type="search" name="q" autocomplete="off"
        [(ngModel)]="searchTerm" (keyup.enter)="onSearch()"
        placeholder="Rechercher un ouvrage, une commune, une alerte..." />
      <kbd class="tb-search-kbd">Ctrl K</kbd>
    </div>

    <!-- DROITE : période, notifications, profil -->
    <div class="tb-right">

      <!-- 4. Période -->
      <div class="tb-period">
        <svg class="tb-period-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        <div class="tb-period-wrap">
          <select class="tb-period-select" [(ngModel)]="period" (change)="onPeriodChange()">
            <option value="7d">7 jours</option>
            <option value="30d">30 jours</option>
            <option value="90d">90 jours</option>
          </select>
          <svg class="tb-period-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      </div>

      <!-- 5. Notifications -->
      <button type="button" class="tb-notif" (click)="refreshNow()" [title]="'nav.alerts' | t">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
        <span class="tb-notif-badge" *ngIf="criticalAlertsCount">{{ criticalAlertsCount }}</span>
      </button>

      <!-- 6. Profil -->
      <details class="tb-profile" #userMenu>
        <summary class="tb-profile-trigger">
          <span class="tb-avatar">{{ userInitials() }}</span>
          <span class="tb-profile-name">{{ user?.username || 'admin' }}</span>
          <svg class="tb-profile-caret" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </summary>
        <div class="tb-profile-panel">
          <div class="tb-panel-header">
            <div class="tb-panel-avatar">{{ userInitials() }}</div>
            <div>
              <div class="tb-panel-name">{{ user?.username || 'admin' }}</div>
              <span class="tb-panel-role">{{ primaryRole() }}</span>
            </div>
          </div>
          <button type="button" class="tb-panel-action" (click)="logout()">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Se deconnecter
          </button>
        </div>
      </details>

    </div>
  </header>

  <!-- Bouton reopen quand sidebar fermee -->
  <button *ngIf="sbState==='closed'" class="sb-reopen" (click)="sbState='open'" aria-label="Ouvrir le menu">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
    </svg>
  </button>

  <section class="admin-dash">

    <!-- SIDEBAR -->
    <aside class="admin-sidebar" aria-label="Navigation principale">
      <div class="admin-sb-identity">
        <div class="admin-sb-brand">
          <div class="admin-sb-logo"><img src="assets/logo_gestidlo.png" alt="GEstiDlo" /></div>
          <div class="admin-sb-brand-text">
            <span class="admin-sb-name">GEST<span class="admin-sb-accent">IDLO</span></span>
            <span class="admin-sb-tagline">Gestion intelligente de l'eau</span>
          </div>
        </div>
        <button class="admin-sb-close" (click)="sbState='closed'" aria-label="Fermer">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <nav class="admin-sb-nav">
        <a class="admin-sb-link" routerLink="/dashboard" routerLinkActive="active" [title]="'nav.dashboard' | t">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg></span>
          <span class="admin-sb-label">{{ 'nav.dashboard' | t }}</span>
        </a>

        <span class="admin-sb-group-label">Supervision</span>
        <a class="admin-sb-link" routerLink="/supervision" routerLinkActive="active" [title]="'nav.cartography' | t">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span>
          <span class="admin-sb-label">{{ 'nav.cartography' | t }}</span>
        </a>
        <a class="admin-sb-link" routerLink="/alerts" routerLinkActive="active" [title]="'nav.alerts' | t">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></span>
          <span class="admin-sb-label">{{ 'nav.alerts' | t }}</span>
          <span class="admin-sb-badge" *ngIf="criticalAlertsCount">{{ criticalAlertsCount }}</span>
        </a>

        <span class="admin-sb-group-label">Gestion</span>
        <a class="admin-sb-link" routerLink="/resources" routerLinkActive="active" [title]="'nav.resources' | t">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69 17.66 8.35a8 8 0 1 1-11.32 0Z"/></svg></span>
          <span class="admin-sb-label">{{ 'nav.resources' | t }}</span>
        </a>
        <a class="admin-sb-link" routerLink="/infrastructures" routerLinkActive="active" [title]="'nav.infrastructure' | t">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/></svg></span>
          <span class="admin-sb-label">{{ 'nav.infrastructure' | t }}</span>
        </a>

        <span class="admin-sb-group-label">Operations</span>
        <a class="admin-sb-link" routerLink="/service" routerLinkActive="active" [title]="'nav.service' | t">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg></span>
          <span class="admin-sb-label">{{ 'nav.service' | t }}</span>
        </a>
        <a class="admin-sb-link" routerLink="/quality" routerLinkActive="active" [title]="'nav.quality' | t">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg></span>
          <span class="admin-sb-label">{{ 'nav.quality' | t }}</span>
        </a>
        <a class="admin-sb-link" routerLink="/traceability" routerLinkActive="active" [title]="'nav.traceability' | t">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/></svg></span>
          <span class="admin-sb-label">{{ 'nav.traceability' | t }}</span>
        </a>

        <span class="admin-sb-group-label">Analyses</span>
        <a class="admin-sb-link" routerLink="/reports" routerLinkActive="active" [title]="'nav.reports' | t">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg></span>
          <span class="admin-sb-label">{{ 'nav.reports' | t }}</span>
        </a>
        <a class="admin-sb-link" routerLink="/governance" routerLinkActive="active" [title]="'nav.governance' | t">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
          <span class="admin-sb-label">{{ 'nav.governance' | t }}</span>
        </a>

        <span class="admin-sb-group-label">Administration</span>
        <a class="admin-sb-link" routerLink="/administration" routerLinkActive="active" [title]="'nav.administration' | t">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg></span>
          <span class="admin-sb-label">{{ 'nav.administration' | t }}</span>
        </a>
      </nav>

      <div class="admin-sb-footer">
        <div class="admin-sb-toggle-row">
          <button class="admin-sb-toggle"
            (click)="sbState = sbState === 'compact' ? 'open' : 'compact'"
            [title]="sbState === 'compact' ? 'Etendre' : 'Reduire'">
            <svg *ngIf="sbState !== 'compact'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <svg *ngIf="sbState === 'compact'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            <span class="admin-sb-toggle-text">Reduire</span>
          </button>
        </div>
        <div class="admin-sb-footer-info">
          <span class="admin-sb-footer-name">GEst<span>IDLO</span></span>
          <span class="admin-sb-footer-desc">Plateforme de supervision AEP</span>
          <span class="admin-sb-footer-ver">v1.0.0</span>
        </div>
      </div>
    </aside>

    <main class="admin-dash__content">
      <router-outlet></router-outlet>
    </main>

  </section>
</section>
  `
})
export class AdminLayoutComponent implements OnDestroy {
  @ViewChild('userMenu') private readonly userMenu?: ElementRef<HTMLDetailsElement>;
  @ViewChild('searchInput') private readonly searchInputEl?: ElementRef<HTMLInputElement>;

  user: AuthUser | null = null;
  sbState: 'open' | 'compact' | 'closed' = 'open';
  currentUrl = '';

  private userSub?: Subscription;
  private refreshSub?: Subscription;
  private routerSub?: Subscription;

  criticalAlertsCount = 0;
  period: '7d' | '30d' | '90d' = '30d';
  searchTerm = '';

  private readonly PAGE_NAMES: Record<string, string> = {
    dashboard:       'Tableau de bord',
    supervision:     'Cartographie',
    alerts:          'Alertes',
    resources:       'Ressources',
    infrastructures: 'Infrastructures',
    service:         'Service',
    quality:         'Qualite',
    traceability:    'Tracabilite',
    reports:         'Rapports',
    governance:      'Gouvernance',
    administration:  'Administration',
  };

  private readonly PAGE_SUBS: Record<string, string> = {
    dashboard:       'Supervision globale du reseau',
    supervision:     'Carte interactive des ouvrages',
    alerts:          'Incidents et notifications actifs',
    resources:       'Ressources en eau et equipements',
    infrastructures: 'Ouvrages et reseaux hydrauliques',
    service:         'Suivi des interventions terrain',
    quality:         'Controle qualite de l\'eau',
    traceability:    'Historique et audits',
    reports:         'Tableaux de bord et exports',
    governance:      'Politiques et conformite',
    administration:  'Gestion des utilisateurs et acces',
  };

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly refresh: RefreshService,
    private readonly api: BffApiService
  ) {
    this.user = this.auth.userSnapshot();
    this.userSub = this.auth.userStream().subscribe((u) => (this.user = u));
    this.refreshSub = this.refresh.refresh$.subscribe(() => this.loadCriticalAlerts());

    this.currentUrl = this.router.url;
    this.routerSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e) => { this.currentUrl = (e as NavigationEnd).urlAfterRedirects; });

    this.loadCriticalAlerts();
  }

  // ── Topbar helpers ──────────────────────────────────────────
  currentPageLabel(): string {
    const seg = this.currentUrl.split('/').filter(Boolean)[0] ?? '';
    return this.PAGE_NAMES[seg] ?? '';
  }

  currentPageSubtitle(): string {
    const seg = this.currentUrl.split('/').filter(Boolean)[0] ?? '';
    return this.PAGE_SUBS[seg] ?? '';
  }

  primaryRole(): string {
    const r = (this.user?.roles ?? [])[0] ?? '';
    const map: Record<string, string> = {
      ADMIN: 'Administrateur', ADMINISTRATOR: 'Administrateur', SUPERADMIN: 'Super admin',
      TECHNICIAN: 'Technicien', TECH: 'Technicien',
      OPERATOR: 'Operateur', OP: 'Operateur',
      VIEWER: 'Observateur', READ_ONLY: 'Observateur',
    };
    return map[r.toUpperCase()] ?? (r || 'Utilisateur');
  }

  // ── General ─────────────────────────────────────────────────
  logout()         { this.auth.logout(); this.router.navigateByUrl('/login'); }
  refreshNow()     { this.refresh.trigger('manual'); }
  onSearch()       { this.refresh.trigger('manual'); }
  onPeriodChange() { this.refresh.trigger('manual'); }

  userInitials(): string {
    const u = (this.user?.username ?? 'A').trim();
    return u ? u.slice(0, 1).toUpperCase() : 'A';
  }

  private loadCriticalAlerts() {
    this.api.alerts('ACTIVE').subscribe({
      next: (rows: any) => {
        const list = Array.isArray(rows) ? rows : [];
        this.criticalAlertsCount = list.filter((a: any) => a?.severity === 'CRIT').length;
      },
      error: () => { this.criticalAlertsCount = 0; }
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      this.searchInputEl?.nativeElement.focus();
    }
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
    this.routerSub?.unsubscribe();
  }
}
