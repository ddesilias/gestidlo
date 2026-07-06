import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';

import { AuthService, AuthUser } from '../auth.service';
import { RefreshService } from '../refresh.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { BffApiService } from '../api/bff-api.service';
import { ClocheNotificationsComponent } from '../ui/cloche-notifications.component';
import { CapteurStore } from '../capteur.store';
import { SharedDrawersService } from '../shared/shared-drawers.service';
import { NouveauReglementDrawerComponent } from '../shared/nouveau-reglement-drawer/nouveau-reglement-drawer.component';
import { ExporterRapportModalComponent } from '../shared/exporter-rapport-modal/exporter-rapport-modal.component';
import { ParametresRapidesDrawerComponent } from '../shared/parametres-rapides-drawer/parametres-rapides-drawer.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe,
    NouveauReglementDrawerComponent, ExporterRapportModalComponent, ParametresRapidesDrawerComponent,
    ClocheNotificationsComponent],
  styles: [`
    /* ═══════════════════════════════════════════════════════════
       ANIMATIONS
    ═══════════════════════════════════════════════════════════ */
    @keyframes sb-dot-pulse {
      0%,100% { box-shadow:0 0 0 0 rgba(52,211,153,.6); }
      50%      { box-shadow:0 0 0 5px rgba(52,211,153,0); }
    }
    @keyframes sb-badge-pulse {
      0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,.5); }
      50%      { box-shadow:0 0 0 4px rgba(239,68,68,0); }
    }
    @keyframes tb-live-glow {
      0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(52,211,153,.5); }
      50%      { opacity:.65; box-shadow:0 0 0 4px rgba(52,211,153,0); }
    }
    @keyframes tbPanelIn {
      from { opacity:0; transform:translateY(-6px) scale(.97); }
      to   { opacity:1; transform:none; }
    }

    /* ═══════════════════════════════════════════════════════════
       SIDEBAR
    ═══════════════════════════════════════════════════════════ */
    .admin-sidebar {
      position:fixed; left:0; top:64px;
      height:calc(100vh - 64px); width:240px;
      z-index:800; display:flex; flex-direction:column;
      /* Verre dépoli SOMBRE : assez opaque pour garder le texte lisible en AA quel que soit
         le fond (cf. mise en garde readability), blur modéré pour rester fluide. */
      background:rgba(12,16,28,0.72);
      backdrop-filter:blur(14px) saturate(1.08);
      -webkit-backdrop-filter:blur(14px) saturate(1.08);
      border-right:0.5px solid rgba(255,255,255,.10);
      box-shadow:inset -1px 0 0 rgba(255,255,255,.04), 8px 0 28px rgba(0,0,0,.28);
      overflow:hidden; transition:width .28s cubic-bezier(.4,0,.2,1);
    }
    /* Repli : navigateurs sans backdrop-filter (ou postes faibles) → fond plein opaque, zéro coût GPU. */
    @supports not ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {
      .admin-sidebar { background:rgba(8,11,20,0.97); }
    }
    .sb-compact .admin-sidebar { width:54px; }
    .sb-closed  .admin-sidebar { width:0; border:none; }

    /* Brand header */
    .admin-sb-brand-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:16px 14px 16px;
      border-bottom:0.5px solid rgba(255,255,255,.06);
      flex-shrink:0; gap:.5rem; min-width:0; overflow:hidden;
    }
    .admin-sb-brand-wrap { display:flex; align-items:center; gap:10px; min-width:0; flex:1; overflow:hidden; }
    .admin-sb-logo-wrap { position:relative; flex-shrink:0; }
    .admin-sb-logo-dot {
      position:absolute; bottom:-1px; right:-1px;
      width:9px; height:9px; border-radius:50%;
      background:#34D399; border:2px solid #080B14;
      animation:sb-dot-pulse 2s ease-in-out infinite;
    }
    .admin-sb-brand-text { min-width:0; flex:1; overflow:hidden; }
    .admin-sb-name {
      display:block; font-size:.9rem; font-weight:500; color:#fff;
      letter-spacing:-.3px; white-space:nowrap; line-height:1;
    }
    .admin-sb-accent { color:#60A5FA; }
    .admin-sb-tagline {
      display:block; font-size:.6rem; color:rgba(255,255,255,.38);
      font-weight:500; white-space:nowrap; letter-spacing:1.5px; margin-top:4px;
      text-transform:uppercase;
    }
    .admin-sb-close {
      width:26px; height:26px; border:0;
      background:transparent; border-radius:7px;
      color:rgba(255,255,255,.3); cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0; transition:background .15s,color .15s;
    }
    .admin-sb-close:hover { background:rgba(255,255,255,.08); color:rgba(255,255,255,.7); }
    .sb-compact .admin-sb-brand-header { justify-content:center; padding:16px 8px; }
    .sb-compact .admin-sb-brand-text,
    .sb-compact .admin-sb-close { display:none; }

    /* Nav */
    .admin-sb-nav {
      flex:1; overflow-y:auto; overflow-x:hidden; padding:.5rem .75rem;
      scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.06) transparent;
    }
    .admin-sb-nav::-webkit-scrollbar { width:3px; }
    .admin-sb-nav::-webkit-scrollbar-thumb { background:rgba(255,255,255,.08); border-radius:2px; }

    .admin-sb-group-label {
      font-size:.6rem; font-weight:600; letter-spacing:.15em;
      text-transform:uppercase; color:rgba(255,255,255,.28);
      padding:.85rem 8px .25rem; display:block;
      white-space:nowrap; overflow:hidden;
    }
    .sb-compact .admin-sb-group-label {
      height:1px; background:rgba(255,255,255,.06);
      padding:0; margin:.45rem .4rem; font-size:0; overflow:hidden; letter-spacing:0;
    }

    .admin-sb-link {
      position:relative; overflow:hidden;
      display:flex; align-items:center; gap:10px;
      padding:8px 12px; border-radius:8px;
      border:1px solid transparent;   /* réservé : l'actif colore ce bord sans décaler le layout */
      color:rgba(255,255,255,.52); text-decoration:none;
      font-size:.835rem; font-weight:500;
      transition:background .15s,color .15s,border-color .15s;
      white-space:nowrap; margin-bottom:1px;
    }
    .admin-sb-link:hover { background:rgba(255,255,255,.05); color:rgba(255,255,255,.82); }
    /* Actif = surbrillance translucide DORÉE + halo (verre dépoli). */
    .admin-sb-link.active {
      background:linear-gradient(90deg,rgba(251,191,36,.20),rgba(255,255,255,.04));
      border-color:rgba(255,214,140,.30);
      box-shadow:0 0 18px rgba(251,191,36,.14);
      color:#fff;
    }
    .admin-sb-link.active::before {
      content:''; position:absolute; left:0; top:7px; bottom:7px;
      width:3px; background:linear-gradient(180deg,#FBBF24,#F59E0B);
      border-radius:0 2px 2px 0; box-shadow:0 0 8px rgba(251,191,36,.6);
    }

    .admin-sb-icon {
      width:30px; height:30px; border-radius:8px;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0; color:rgba(255,255,255,.32); transition:color .15s;
    }
    .admin-sb-link:hover  .admin-sb-icon { color:rgba(255,255,255,.65); }
    .admin-sb-link.active .admin-sb-icon { color:#FBBF24; }

    .admin-sb-label { flex:1; white-space:nowrap; overflow:hidden; }
    .sb-compact .admin-sb-link  { justify-content:center; padding:.52rem; gap:0; }
    .sb-compact .admin-sb-label { display:none; }
    .sb-compact .admin-sb-icon  { width:38px; height:38px; }

    .admin-sb-badge {
      display:flex; align-items:center; gap:4px;
      font-size:.65rem; font-weight:600;
      padding:.1rem .42rem; border-radius:999px;
      margin-left:auto; flex-shrink:0; line-height:1.4;
    }
    .admin-sb-badge--danger {
      background:rgba(239,68,68,.15); color:#F87171;
      border:0.5px solid rgba(239,68,68,.3);
    }
    .admin-sb-badge--cyan {
      background:rgba(34,211,238,.1); color:#22D3EE;
      border:0.5px solid rgba(34,211,238,.18);
    }
    .sb-compact .admin-sb-badge { display:none; }

    .admin-sb-badge-dot {
      width:5px; height:5px; border-radius:50%; background:#F87171; flex-shrink:0;
      animation:sb-badge-pulse 2s ease-in-out infinite;
    }

    /* Live status footer */
    .admin-sb-footer {
      flex-shrink:0; padding:10px 12px;
      border-top:0.5px solid rgba(255,255,255,.06); overflow:hidden;
    }
    .admin-sb-status {
      padding:10px 12px;
      background:linear-gradient(135deg,rgba(96,165,250,.09),rgba(139,92,246,.07));
      border:0.5px solid rgba(96,165,250,.18); border-radius:10px;
    }
    .admin-sb-status-head { display:flex; align-items:center; gap:7px; margin-bottom:5px; }
    .admin-sb-status-dot {
      width:7px; height:7px; border-radius:50%; background:#34D399;
      box-shadow:0 0 8px rgba(52,211,153,.55); flex-shrink:0;
    }
    .admin-sb-status-title {
      font-size:.62rem; color:#fff; font-weight:500; letter-spacing:.04em;
    }
    .admin-sb-status-info { font-size:.63rem; color:rgba(255,255,255,.48); line-height:1.55; }
    .admin-sb-status-ver  { color:rgba(255,255,255,.28); }
    .sb-compact .admin-sb-status { display:none; }

    /* ═══════════════════════════════════════════════════════════
       TOPBAR PREMIUM
    ═══════════════════════════════════════════════════════════ */
    /* Toggle */
    .tb-sb-toggle {
      width:32px; height:32px; border:0; border-radius:8px;
      background:rgba(255,255,255,.04);
      border:0.5px solid rgba(255,255,255,.1);
      color:rgba(255,255,255,.7); cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0; transition:background .15s,color .15s;
    }
    .tb-sb-toggle:hover { background:rgba(255,255,255,.1); color:#fff; }

    /* Groups */
    .tb-left  { display:flex; align-items:center; gap:.65rem; flex-shrink:0; }
    .tb-right { display:flex; align-items:center; gap:.45rem; flex-shrink:0; margin-left:auto; }
    .tb-sep   { width:1px; height:18px; background:rgba(255,255,255,.08); flex-shrink:0; margin:0 3px; }

    /* Breadcrumb */
    .tb-bread { display:flex; align-items:center; gap:.38rem; flex-shrink:0; }
    .tb-bread-item {
      display:flex; align-items:center; gap:.28rem;
      font-size:.75rem; color:rgba(255,255,255,.4);
      white-space:nowrap;
    }
    .tb-bread-sep { color:rgba(255,255,255,.2); flex-shrink:0; }
    .tb-bread-current { font-size:.75rem; font-weight:500; color:rgba(255,255,255,.88); white-space:nowrap; }

    /* Search */
    .tb-search {
      flex:1; min-width:0; max-width:480px; margin:0 auto;
      position:relative; display:flex; align-items:center;
    }
    .tb-search-icon { position:absolute; left:11px; pointer-events:none; color:rgba(255,255,255,.38); flex-shrink:0; }
    .tb-search-input {
      width:100%; padding:8px 68px 8px 34px;
      background:rgba(255,255,255,.04);
      border:0.5px solid rgba(255,255,255,.1); border-radius:8px;
      color:#fff; font-size:.78rem; font-family:inherit; outline:none;
      transition:background .15s, border-color .2s;
      box-sizing:border-box;
    }
    .tb-search-input::placeholder { color:rgba(255,255,255,.3); }
    .tb-search-input:focus {
      background:rgba(255,255,255,.07); border-color:rgba(96,165,250,.4);
      box-shadow:0 0 0 3px rgba(96,165,250,.1);
    }
    .tb-search-kbds { position:absolute; right:9px; display:flex; gap:3px; pointer-events:none; }
    .tb-search-kbd {
      font-size:.62rem; padding:2px 5px;
      background:rgba(255,255,255,.06); border:0.5px solid rgba(255,255,255,.1);
      border-radius:4px; color:rgba(255,255,255,.42); font-family:inherit;
    }

    /* LIVE */
    .tb-live {
      display:flex; align-items:center; gap:5px;
      padding:5px 10px;
      background:rgba(52,211,153,.07); border:0.5px solid rgba(52,211,153,.2);
      border-radius:7px; flex-shrink:0;
    }
    .tb-live-dot {
      width:6px; height:6px; border-radius:50%; background:#34D399;
      box-shadow:0 0 6px rgba(52,211,153,.7); flex-shrink:0;
      animation:tb-live-glow 2s ease-in-out infinite;
    }
    .tb-live-text { font-size:.65rem; color:#34D399; font-weight:600; letter-spacing:.05em; }

    /* Period */
    .tb-period {
      display:flex; align-items:center; gap:.35rem; flex-shrink:0;
      padding:5px 10px;
      background:rgba(255,255,255,.04);
      border:0.5px solid rgba(255,255,255,.1); border-radius:7px;
      transition:background .15s;
    }
    .tb-period:hover { background:rgba(255,255,255,.09); }
    .tb-period-icon { color:rgba(255,255,255,.45); flex-shrink:0; }
    .tb-period-wrap { position:relative; display:flex; align-items:center; }
    .tb-period-select {
      border:0; outline:none; background:transparent;
      font-size:.78rem; font-weight:500; color:rgba(255,255,255,.85);
      cursor:pointer; appearance:none; padding-right:.9rem; font-family:inherit;
    }
    .tb-period-select option { background:#0b1220; color:#fff; }
    .tb-period-chevron { position:absolute; right:0; pointer-events:none; color:rgba(255,255,255,.35); }

    /* Icon buttons 32×32 */
    .tb-icon-btn {
      width:32px; height:32px; border:0;
      background:rgba(255,255,255,.04);
      border:0.5px solid rgba(255,255,255,.1); border-radius:7px;
      color:rgba(255,255,255,.7); cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0; position:relative; transition:background .15s, color .15s;
    }
    .tb-icon-btn:hover { background:rgba(255,255,255,.1); color:#fff; }

    .tb-notif-badge {
      position:absolute; top:-4px; right:-4px;
      min-width:16px; height:16px; padding:0 4px;
      background:#EF4444; color:#fff;
      font-size:.55rem; font-weight:700;
      border-radius:999px; border:1.5px solid #0A0E1A;
      display:flex; align-items:center; justify-content:center; line-height:1;
    }

    /* Avatar / profile */
    .tb-avatar-wrap { position:relative; flex-shrink:0; }
    .tb-avatar {
      width:28px; height:28px; border-radius:50%;
      background:linear-gradient(135deg,#60A5FA,#8B5CF6);
      color:#fff; font-size:.78rem; font-weight:600;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0;
    }
    .tb-avatar-dot {
      position:absolute; bottom:-1px; right:-1px;
      width:8px; height:8px; border-radius:50%;
      background:#34D399; border:1.5px solid #0A0E1A;
    }

    .tb-profile { flex-shrink:0; position:relative; list-style:none; }
    .tb-profile summary { list-style:none; outline:none; }
    .tb-profile summary::-webkit-details-marker { display:none; }
    .tb-profile-trigger {
      display:flex; align-items:center; gap:.5rem;
      padding:4px 10px 4px 4px;
      background:rgba(255,255,255,.04);
      border:0.5px solid rgba(255,255,255,.1);
      border-radius:999px; cursor:pointer;
      transition:background .15s;
    }
    .tb-profile-trigger:hover { background:rgba(255,255,255,.09); }
    .tb-profile-info { display:flex; flex-direction:column; line-height:1; }
    .tb-profile-name { font-size:.8rem; font-weight:500; color:#fff; white-space:nowrap; }
    .tb-profile-role { font-size:.63rem; color:rgba(255,255,255,.42); margin-top:2px; white-space:nowrap; }
    .tb-profile-caret { color:rgba(255,255,255,.32); flex-shrink:0; }

    /* Dropdown panel */
    .tb-profile[open] .tb-profile-panel { display:block; }
    .tb-profile-panel {
      display:none; position:absolute; top:calc(100% + .5rem); right:0;
      background:#111827; border-radius:12px;
      box-shadow:0 16px 48px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.2);
      min-width:200px; z-index:500; overflow:hidden;
      border:0.5px solid rgba(255,255,255,.1); animation:tbPanelIn .14s ease;
    }
    .tb-panel-header {
      display:flex; align-items:center; gap:.65rem;
      padding:.85rem 1rem;
      border-bottom:0.5px solid rgba(255,255,255,.08);
    }
    .tb-panel-avatar {
      width:36px; height:36px; border-radius:50%;
      background:linear-gradient(135deg,#60A5FA,#8B5CF6);
      color:#fff; font-size:.88rem; font-weight:600;
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
    }
    .tb-panel-name { font-size:.84rem; font-weight:600; color:#e2e8f0; line-height:1.2; }
    .tb-panel-role { font-size:.7rem; color:rgba(255,255,255,.42); font-weight:400; margin-top:.12rem; display:block; }
    .tb-panel-action {
      width:100%; padding:.62rem 1rem; border:0; background:transparent;
      text-align:left; font-size:.82rem; font-weight:500; color:#F87171;
      cursor:pointer; display:flex; align-items:center; gap:.5rem;
      transition:background .15s; font-family:inherit;
    }
    .tb-panel-action:hover { background:rgba(239,68,68,.08); }
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

    <!-- GAUCHE : toggle + breadcrumb -->
    <div class="tb-left">
      <button class="tb-sb-toggle" type="button"
        (click)="sbState = sbState === 'open' ? 'compact' : sbState === 'compact' ? 'closed' : 'open'"
        title="Sidebar">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <nav class="tb-bread">
        <span class="tb-bread-item">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10"/></svg>
          Accueil
        </span>
        <svg class="tb-bread-sep" viewBox="0 0 24 24" width="11" height="11" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.5"/></svg>
        <span class="tb-bread-item">Supervision</span>
        <svg class="tb-bread-sep" viewBox="0 0 24 24" width="11" height="11" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.5"/></svg>
        <span class="tb-bread-current">{{ currentPageLabel() || 'Tableau de bord' }}</span>
      </nav>
    </div>

    <!-- CENTRE : recherche -->
    <div class="tb-search">
      <svg class="tb-search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/>
      </svg>
      <input #searchInput class="tb-search-input" type="search" name="q" autocomplete="off"
        [(ngModel)]="searchTerm" (keyup.enter)="onSearch()"
        placeholder="Rechercher un ouvrage, une commune, une alerte…" />
      <div class="tb-search-kbds">
        <kbd class="tb-search-kbd">⌘</kbd>
        <kbd class="tb-search-kbd">K</kbd>
      </div>
    </div>

    <!-- DROITE : LIVE · période · actions · avatar -->
    <div class="tb-right">

      <div class="tb-live">
        <span class="tb-live-dot"></span>
        <span class="tb-live-text">LIVE</span>
      </div>

      <div class="tb-period">
        <svg class="tb-period-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        <div class="tb-period-wrap">
          <select class="tb-period-select" [(ngModel)]="period" (change)="onPeriodChange()">
            <option value="7d">7 jours</option>
            <option value="30d">30 jours</option>
            <option value="90d">90 jours</option>
          </select>
          <svg class="tb-period-chevron" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      </div>

      <div class="tb-sep"></div>

      <button class="tb-icon-btn" type="button" (click)="refreshNow()" title="Actualiser">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M21 12a9 9 0 0 1-3 6.9M21 4v5h-5"/><path d="M3 12a9 9 0 0 0 3 6.9M3 20v-5h5"/>
        </svg>
      </button>

      <app-cloche-notifications></app-cloche-notifications>

      <button class="tb-icon-btn" type="button" title="Paramètres rapides" (click)="drawers.openParametresRapides()">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
        </svg>
      </button>

      <div class="tb-sep"></div>

      <details class="tb-profile" #userMenu>
        <summary class="tb-profile-trigger">
          <div class="tb-avatar-wrap">
            <span class="tb-avatar">{{ userInitials() }}</span>
            <span class="tb-avatar-dot"></span>
          </div>
          <div class="tb-profile-info">
            <span class="tb-profile-name">{{ user?.username || 'admin' }}</span>
            <span class="tb-profile-role">{{ primaryRole() }}</span>
          </div>
          <svg class="tb-profile-caret" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
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
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Se déconnecter
          </button>
        </div>
      </details>

    </div>
  </header>

  <section class="admin-dash">

    <!-- ═══════════════════════════════════════════════════════════
         SIDEBAR PREMIUM
    ═══════════════════════════════════════════════════════════ -->
    <aside class="admin-sidebar" aria-label="Navigation principale">

      <!-- BRAND -->
      <div class="admin-sb-brand-header">
        <div class="admin-sb-brand-wrap">
          <div class="admin-sb-logo-wrap">
            <svg width="28" height="28" viewBox="0 0 64 64" fill="none">
              <defs>
                <linearGradient id="sbg1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#60A5FA"/>
                  <stop offset="100%" stop-color="#3B82F6"/>
                </linearGradient>
              </defs>
              <path d="M32 6C32 6 14 26 14 40A18 18 0 0 0 50 40C50 26 32 6 32 6Z" fill="url(#sbg1)"/>
              <path d="M32 18C32 18 24 30 24 38A8 8 0 0 0 40 38C40 30 32 18 32 18Z" fill="#080B14"/>
              <circle cx="32" cy="38" r="3" fill="#A78BFA"/>
            </svg>
            <span class="admin-sb-logo-dot"></span>
          </div>
          <div class="admin-sb-brand-text">
            <span class="admin-sb-name">GEST<span class="admin-sb-accent">IDLO</span></span>
            <span class="admin-sb-tagline">Supervision AEP</span>
          </div>
        </div>
        <button class="admin-sb-close" type="button"
          (click)="sbState = sbState === 'open' ? 'compact' : 'open'"
          title="Réduire">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
            <path d="M11 19l-7-7 7-7M19 19l-7-7 7-7"/>
          </svg>
        </button>
      </div>

      <nav class="admin-sb-nav">

        <!-- ── PRINCIPAL ─────────────────────────────────────── -->
        <span class="admin-sb-group-label">Principal</span>
        <a class="admin-sb-link" routerLink="/admin/dashboard" routerLinkActive="active" [title]="'nav.dashboard' | t">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg></span>
          <span class="admin-sb-label">Tableau de bord</span>
        </a>
        <a class="admin-sb-link" routerLink="/admin/resources" routerLinkActive="active">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg></span>
          <span class="admin-sb-label">Ressources</span>
        </a>
        <a class="admin-sb-link" routerLink="/admin/infrastructures" routerLinkActive="active">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/></svg></span>
          <span class="admin-sb-label">Infrastructures</span>
        </a>
        <a class="admin-sb-link" routerLink="/admin/alertes" routerLinkActive="active">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></span>
          <span class="admin-sb-label">Alertes</span>
          <span class="admin-sb-badge admin-sb-badge--danger" *ngIf="criticalAlertsCount">
            <span class="admin-sb-badge-dot"></span>{{ criticalAlertsCount }}
          </span>
        </a>
<a class="admin-sb-link" routerLink="/admin/interventions" routerLinkActive="active">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></span>
          <span class="admin-sb-label">Interventions</span>
        </a>

        <!-- ── DONNÉES & IoT ──────────────────────────────────── -->
        <span class="admin-sb-group-label">Données &amp; IoT</span>
        <a class="admin-sb-link" routerLink="/admin/capteurs" routerLinkActive="active">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="10" r="3"/></svg></span>
          <span class="admin-sb-label">Capteurs IoT</span>
          <span class="admin-sb-badge admin-sb-badge--cyan">{{ capteurStore.all().length }}</span>
        </a>
        <a class="admin-sb-link" routerLink="/admin/points" routerLinkActive="active">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg></span>
          <span class="admin-sb-label">Points de mesure</span>
        </a>
        <a class="admin-sb-link" routerLink="/admin/supervision" routerLinkActive="active">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></span>
          <span class="admin-sb-label">Données temps réel</span>
        </a>
        <a class="admin-sb-link" routerLink="/admin/quality" routerLinkActive="active">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg></span>
          <span class="admin-sb-label">Qualité de l'eau</span>
        </a>

        <!-- ── GOUVERNANCE ────────────────────────────────────── -->
        <span class="admin-sb-group-label">Gouvernance</span>
        <a class="admin-sb-link" routerLink="/admin/governance" routerLinkActive="active">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
          <span class="admin-sb-label">Gouvernance</span>
        </a>
        <a class="admin-sb-link" routerLink="/admin/rapports" routerLinkActive="active">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg></span>
          <span class="admin-sb-label">Rapports</span>
        </a>
        <a class="admin-sb-link" routerLink="/admin/rapports-recus" routerLinkActive="active">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg></span>
          <span class="admin-sb-label">Rapports reçus</span>
        </a>
        <a class="admin-sb-link" routerLink="/admin/traceability" routerLinkActive="active">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/></svg></span>
          <span class="admin-sb-label">Traçabilité</span>
        </a>
        <a class="admin-sb-link" routerLink="/admin/administration" routerLinkActive="active">
          <span class="admin-sb-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
          <span class="admin-sb-label">Utilisateurs</span>
        </a>

      </nav>

      <!-- LIVE STATUS FOOTER -->
      <div class="admin-sb-footer">
        <div class="admin-sb-status">
          <div class="admin-sb-status-head">
            <span class="admin-sb-status-dot"></span>
            <span class="admin-sb-status-title">Système opérationnel</span>
          </div>
          <div class="admin-sb-status-info">
            Sync il y a 12s · Latence 23ms<br>
            <span class="admin-sb-status-ver">v1.0.0 · Build 2026.05.02</span>
          </div>
        </div>
      </div>
    </aside>

    <main class="admin-dash__content">
      <router-outlet></router-outlet>
    </main>

  </section>

  <app-nouveau-reglement-drawer
    [visible]="drawers.showNouveauReglement()"
    (fermer)="drawers.showNouveauReglement.set(false)">
  </app-nouveau-reglement-drawer>

  <app-exporter-rapport-modal
    [visible]="drawers.showExporterRapport()"
    (fermer)="drawers.showExporterRapport.set(false)">
  </app-exporter-rapport-modal>

  <app-parametres-rapides-drawer
    [visible]="drawers.showParametresRapides()"
    (fermer)="drawers.showParametresRapides.set(false)">
  </app-parametres-rapides-drawer>

</section>
  `
})
export class AdminLayoutComponent implements OnDestroy {
  @ViewChild('userMenu') private readonly userMenu?: ElementRef<HTMLDetailsElement>;
  @ViewChild('searchInput') private readonly searchInputEl?: ElementRef<HTMLInputElement>;

  readonly capteurStore = inject(CapteurStore);
  readonly drawers      = inject(SharedDrawersService);

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
    supervision:     'Données temps réel',
    alerts:          'Alertes',
    alertes:         'Alertes',
    console:         'Console opérationnelle',
    tickets:         'Interventions',
    interventions:   'Interventions terrain',
    resources:       'Ressources',
    infrastructures: 'Infrastructures',
    service:         "Service d'eau potable",
    points:          'Capteurs IoT',
    quality:         "Qualité de l'eau",
    traceability:    'Traçabilité',
    reports:         'Rapports',
    governance:      'Gouvernance',
    administration:  'Utilisateurs',
    config:          'Paramètres',
    configuration:   'Paramètres',
  };

  private readonly PAGE_SUBS: Record<string, string> = {
    dashboard:       'Supervision globale du réseau',
    supervision:     'Carte interactive et monitoring en temps réel',
    alerts:          'Incidents et notifications actifs',
    alertes:         'Incidents et notifications actifs',
    console:         'Vue temps réel — tableau, kanban, salle de contrôle',
    tickets:         'Suivi des interventions terrain',
    interventions:   'Centre opérationnel — du problème détecté à la résolution validée',
    resources:       'Ressources en eau et équipements',
    infrastructures: 'Ouvrages et réseaux hydrauliques',
    service:         "Disponibilité, continuité et desserte du réseau AEP",
    points:          'Équipements IoT connectés et télémétrie',
    quality:         "Contrôle qualité et analyses physicochimiques",
    traceability:    "Journal d'audit, interventions et preuves terrain",
    reports:         'Bibliothèque documentaire — rapports techniques, opérationnels et institutionnels',
    governance:      'Organisation institutionnelle et circuits de validation',
    administration:  'Gestion des utilisateurs et droits d\'accès',
    config:          'Configuration du système',
    configuration:   'Configuration du système',
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
    const parts = this.currentUrl.split('/').filter(Boolean);
    const seg = (parts[0] === 'admin' ? parts[1] : parts[0]) ?? '';
    return this.PAGE_NAMES[seg] ?? '';
  }

  currentPageSubtitle(): string {
    const parts = this.currentUrl.split('/').filter(Boolean);
    const seg = (parts[0] === 'admin' ? parts[1] : parts[0]) ?? '';
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
