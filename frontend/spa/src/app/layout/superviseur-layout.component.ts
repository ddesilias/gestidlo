import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, AuthUser } from '../auth.service';
import { ScopeService } from '../scope.service';
import { AlerteStateService } from '../pages/alertes/alerte-state.service';
import { RapportsStore } from '../rapports.store';
import { ActeurStore } from '../acteur.store';
import { RecensementService } from '../recensement.service';
import { NotificationService } from '../notification.service';
import { NouvelleAlerteComponent } from '../pages/alertes/nouvelle-alerte/nouvelle-alerte.component';
import { ClocheNotificationsComponent } from '../ui/cloche-notifications.component';
import { ResourcesPageComponent } from '../pages/resources-page.component';
import { InfrastructuresPageComponent } from '../pages/infrastructures-page.component';

@Component({
  selector: 'app-superviseur-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ResourcesPageComponent, InfrastructuresPageComponent, NouvelleAlerteComponent, ClocheNotificationsComponent],
  styles: [`
    /* ═══ SHELL ═══════════════════════════════════════════════ */
    .sup-shell { min-height:100vh; background:#080B14; overflow-x:hidden; font-family:-apple-system,system-ui,sans-serif; }

    /* ═══ TOPBAR ═══════════════════════════════════════════════ */
    .sup-topbar {
      position:fixed; top:0; left:0; right:0; z-index:900; height:60px;
      display:flex; align-items:center; padding:0 1.25rem; gap:.75rem;
      background:rgba(8,11,20,.97);
      border-bottom:.5px solid rgba(16,185,129,.18);
      box-shadow:0 4px 20px rgba(0,0,0,.35);
    }
    .sup-tb-brand {
      display:flex; align-items:center; gap:.5rem; text-decoration:none; flex-shrink:0;
    }
    .sup-tb-brand-name { font-size:.9rem; font-weight:700; color:#fff; letter-spacing:-.02em; }
    .sup-tb-accent { color:#34D399; }
    .sup-tb-ctx {
      display:flex; align-items:center; gap:.5rem; padding:.3rem .75rem;
      background:rgba(16,185,129,.06); border:0.5px solid rgba(16,185,129,.2); border-radius:999px;
    }
    .sup-tb-ctx-dot {
      width:6px; height:6px; border-radius:50%; background:#34D399; flex-shrink:0;
      box-shadow:0 0 6px rgba(52,211,153,.7);
    }
    .sup-tb-ctx-label { font-size:.72rem; font-weight:600; color:#34D399; letter-spacing:.04em; white-space:nowrap; }
    .sup-tb-spacer { flex:1; }
    .sup-bell { position:relative; display:flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:999px; background:transparent; border:0; color:rgba(255,255,255,.6); cursor:pointer; }
    .sup-bell:hover { background:rgba(255,255,255,.06); color:#fff; }
    .sup-bell-badge { position:absolute; top:-1px; right:-1px; min-width:15px; height:15px; padding:0 4px; border-radius:999px; background:#F87171; color:#fff; font-size:9px; font-weight:700; line-height:15px; text-align:center; }
    .sup-profile { position:relative; list-style:none; }
    .sup-profile summary { list-style:none; outline:none; }
    .sup-profile summary::-webkit-details-marker { display:none; }
    .sup-profile-trigger {
      display:flex; align-items:center; gap:.5rem; padding:4px 10px 4px 4px;
      background:rgba(255,255,255,.04); border:.5px solid rgba(255,255,255,.1);
      border-radius:999px; cursor:pointer; transition:background .15s;
    }
    .sup-profile-trigger:hover { background:rgba(255,255,255,.09); }
    .sup-avatar {
      width:28px; height:28px; border-radius:50%;
      background:linear-gradient(135deg,#3B82F6,#10B981);
      color:#fff; font-size:.78rem; font-weight:700;
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
    }
    .sup-profile-info { display:flex; flex-direction:column; line-height:1; }
    .sup-profile-name { font-size:.8rem; font-weight:500; color:#fff; white-space:nowrap; }
    .sup-profile-role { font-size:.63rem; color:rgba(255,255,255,.42); margin-top:2px; white-space:nowrap; }
    .sup-profile-caret { color:rgba(255,255,255,.32); flex-shrink:0; }

    @keyframes sup-panel-in { from { opacity:0; transform:translateY(-6px) scale(.97); } to { opacity:1; transform:none; } }
    .sup-profile[open] .sup-profile-panel { display:block; }
    .sup-profile-panel {
      display:none; position:absolute; top:calc(100% + .5rem); right:0; min-width:200px;
      background:#111827; border-radius:12px; border:.5px solid rgba(255,255,255,.1);
      box-shadow:0 16px 48px rgba(0,0,0,.55); z-index:500; overflow:hidden;
      animation:sup-panel-in .14s ease;
    }
    .sup-panel-header {
      display:flex; align-items:center; gap:.65rem; padding:.85rem 1rem;
      border-bottom:.5px solid rgba(255,255,255,.08);
    }
    .sup-panel-avatar {
      width:36px; height:36px; border-radius:50%; flex-shrink:0;
      background:linear-gradient(135deg,#3B82F6,#10B981);
      color:#fff; font-size:.88rem; font-weight:700;
      display:flex; align-items:center; justify-content:center;
    }
    .sup-panel-name { font-size:.84rem; font-weight:600; color:#e2e8f0; line-height:1.2; }
    .sup-panel-role { font-size:.7rem; color:rgba(255,255,255,.42); display:block; margin-top:.1rem; }
    .sup-panel-action {
      width:100%; padding:.62rem 1rem; border:0; background:transparent;
      text-align:left; font-size:.82rem; font-weight:500; color:#F87171;
      cursor:pointer; display:flex; align-items:center; gap:.5rem; font-family:inherit;
      transition:background .15s;
    }
    .sup-panel-action:hover { background:rgba(239,68,68,.08); }

    /* ═══ SIDEBAR ══════════════════════════════════════════════ */
    .sup-sidebar {
      position:fixed; left:0; top:60px; height:calc(100vh - 60px); width:220px;
      z-index:800; display:flex; flex-direction:column;
      background:rgba(8,11,20,.97); border-right:.5px solid rgba(16,185,129,.1);
      overflow:hidden;
    }

    /* Identity card */
    .sup-id-card {
      display:flex; align-items:center; gap:.65rem; padding:14px;
      background:rgba(16,185,129,.06); border-bottom:.5px solid rgba(16,185,129,.12);
      flex-shrink:0;
    }
    .sup-id-avatar {
      width:36px; height:36px; border-radius:50%; flex-shrink:0;
      background:linear-gradient(135deg,#3B82F6,#10B981);
      color:#fff; font-size:.85rem; font-weight:700;
      display:flex; align-items:center; justify-content:center;
    }
    .sup-id-name { font-size:.82rem; font-weight:600; color:#F5F7FA; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .sup-id-role { font-size:.68rem; color:#34D399; margin-top:2px; white-space:nowrap; }

    /* Nav */
    .sup-nav { flex:1; overflow-y:auto; padding:.5rem .75rem; display:flex; flex-direction:column; gap:2px; }
    .sup-nav::-webkit-scrollbar { width:3px; }
    .sup-nav::-webkit-scrollbar-thumb { background:rgba(255,255,255,.08); border-radius:2px; }

    .sup-nav-link {
      display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:8px;
      color:rgba(255,255,255,.52); text-decoration:none; font-size:.835rem; font-weight:500;
      transition:background .15s, color .15s; white-space:nowrap; position:relative; overflow:hidden;
    }
    .sup-nav-link:hover { background:rgba(255,255,255,.05); color:rgba(255,255,255,.82); }
    .sup-nav-link.active {
      background:linear-gradient(90deg,rgba(16,185,129,.15),rgba(16,185,129,.02));
      color:#fff;
    }
    .sup-nav-link.active::before {
      content:''; position:absolute; left:0; top:7px; bottom:7px;
      width:3px; background:linear-gradient(180deg,#34D399,#10B981);
      border-radius:0 2px 2px 0; box-shadow:0 0 8px rgba(52,211,153,.65);
    }
    .sup-nav-icon {
      width:28px; height:28px; border-radius:7px;
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
      color:rgba(255,255,255,.32); transition:color .15s;
    }
    .sup-nav-link:hover  .sup-nav-icon { color:rgba(255,255,255,.65); }
    .sup-nav-link.active .sup-nav-icon { color:#34D399; }
    .sup-nav-label { flex:1; }
    .sup-nav-badge {
      font-size:.62rem; font-weight:700; padding:.1rem .42rem; border-radius:999px;
      margin-left:auto; flex-shrink:0; line-height:1.4;
    }
    .sup-nav-badge--red   { background:rgba(239,68,68,.15); color:#F87171; border:.5px solid rgba(239,68,68,.3); }
    .sup-nav-badge--amber { background:rgba(251,191,36,.12); color:#FBBF24; border:.5px solid rgba(251,191,36,.25); }
    .sup-nav-badge--blue  { background:rgba(96,165,250,.12); color:#60A5FA; border:.5px solid rgba(96,165,250,.22); }

    /* Group labels */
    .sup-nav-group { font-size:9px; letter-spacing:1px; text-transform:uppercase; color:#5b6470; padding:10px 10px 5px; }
    .sup-nav-group:first-child { padding-top:2px; }

    /* Muted count (non-alerting, ex. techniciens) */
    .sup-nav-count { font-size:10px; color:#6b7785; margin-left:auto; flex-shrink:0; }

    /* Disabled (pas encore câblé) */
    .sup-nav-link--disabled { opacity:.4; cursor:default; }
    .sup-nav-link--disabled:hover { background:transparent; color:rgba(255,255,255,.52); }
    .sup-nav-link--disabled:hover .sup-nav-icon { color:rgba(255,255,255,.32); }

    /* Sidebar footer / logout */
    .sup-sidebar-footer { flex-shrink:0; padding:10px 12px; border-top:.5px solid rgba(255,255,255,.06); }
    .sup-logout-btn {
      width:100%; display:flex; align-items:center; gap:9px; padding:9px 10px; border-radius:8px;
      background:transparent; border:0; color:rgba(255,255,255,.35); font-size:.82rem; font-weight:500;
      cursor:pointer; font-family:inherit; transition:background .15s, color .15s; text-align:left;
    }
    .sup-logout-btn:hover { background:rgba(239,68,68,.08); color:#F87171; }

    /* ═══ MAIN AREA ════════════════════════════════════════════ */
    .sup-main { padding-left:220px; padding-top:60px; min-height:100vh; }
    .sup-content { padding:1.25rem 1.35rem; color:#E2E8EE; }
  `],
  template: `
<section class="sup-shell">

  <!-- TOPBAR -->
  <header class="sup-topbar">
    <a class="sup-tb-brand" routerLink="/superviseur/tableau-de-bord">
      <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
        <defs><linearGradient id="sg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#34D399"/><stop offset="100%" stop-color="#10B981"/>
        </linearGradient></defs>
        <path d="M32 6C32 6 14 26 14 40A18 18 0 0 0 50 40C50 26 32 6 32 6Z" fill="url(#sg1)"/>
        <path d="M32 18C32 18 24 30 24 38A8 8 0 0 0 40 38C40 30 32 18 32 18Z" fill="#080B14"/>
        <circle cx="32" cy="38" r="3" fill="#A78BFA"/>
      </svg>
      <span class="sup-tb-brand-name">GEST<span class="sup-tb-accent">IDLO</span></span>
    </a>
    <div class="sup-tb-ctx">
      <span class="sup-tb-ctx-dot"></span>
      <span class="sup-tb-ctx-label">SUPERVISION {{ urdLabel | uppercase }}</span>
    </div>
    <div class="sup-tb-spacer"></div>
    <app-cloche-notifications></app-cloche-notifications>
    <details class="sup-profile" #userMenu>
      <summary class="sup-profile-trigger">
        <div class="sup-avatar">{{ userInitials }}</div>
        <div class="sup-profile-info">
          <span class="sup-profile-name">{{ displayName }}</span>
          <span class="sup-profile-role">Responsable · {{ urdLabel }}</span>
        </div>
        <svg class="sup-profile-caret" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
      </summary>
      <div class="sup-profile-panel">
        <div class="sup-panel-header">
          <div class="sup-panel-avatar">{{ userInitials }}</div>
          <div>
            <div class="sup-panel-name">{{ displayName }}</div>
            <span class="sup-panel-role">{{ urdLabel }}</span>
          </div>
        </div>
        <button type="button" class="sup-panel-action" (click)="logout()">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Se déconnecter
        </button>
      </div>
    </details>
  </header>

  <!-- BODY -->
  <div class="sup-main">

    <!-- SIDEBAR -->
    <aside class="sup-sidebar">

      <div class="sup-id-card">
        <div class="sup-id-avatar">{{ userInitials }}</div>
        <div>
          <div class="sup-id-name">{{ displayName }}</div>
          <div class="sup-id-role">Responsable · {{ urdLabel }}</div>
        </div>
      </div>

      <nav class="sup-nav">

        <div class="sup-nav-group">Pilotage</div>

        <a class="sup-nav-link" routerLink="/superviseur/tableau-de-bord" routerLinkActive="active">
          <span class="sup-nav-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/>
              <rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>
            </svg>
          </span>
          <span class="sup-nav-label">Tableau de bord</span>
        </a>

        <a class="sup-nav-link" routerLink="/superviseur/carte" routerLinkActive="active">
          <span class="sup-nav-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
          </span>
          <span class="sup-nav-label">Ma carte</span>
        </a>

        <a class="sup-nav-link" routerLink="/superviseur/alertes" routerLinkActive="active">
          <span class="sup-nav-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>
          </span>
          <span class="sup-nav-label">Alertes à traiter</span>
          <span *ngIf="nbAlertesActives" class="sup-nav-badge sup-nav-badge--red">{{ nbAlertesActives }}</span>
        </a>

        <a class="sup-nav-link" routerLink="/superviseur/rapports" routerLinkActive="active">
          <span class="sup-nav-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/>
              <line x1="12" y1="12" x2="12" y2="18"/>
            </svg>
          </span>
          <span class="sup-nav-label">Rapports à valider</span>
          <span *ngIf="nbRapportsAValider" class="sup-nav-badge sup-nav-badge--amber">{{ nbRapportsAValider }}</span>
        </a>

        <a class="sup-nav-link" routerLink="/superviseur/interventions" routerLinkActive="active">
          <span class="sup-nav-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </span>
          <span class="sup-nav-label">Interventions</span>
        </a>

        <div class="sup-nav-group">Référentiel</div>

        <a class="sup-nav-link" routerLink="/superviseur/territoire" routerLinkActive="active">
          <span class="sup-nav-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M9 22s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" opacity=".5"/>
              <path d="M18 9h3M18 13h3M18 17h3"/>
            </svg>
          </span>
          <span class="sup-nav-label">Territoire &amp; communes</span>
        </a>

        <a class="sup-nav-link" routerLink="/superviseur/infrastructures" routerLinkActive="active">
          <span class="sup-nav-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 20h20M4 20V10l5 3V10l5 3V5h6v15"/>
            </svg>
          </span>
          <span class="sup-nav-label">Infrastructures</span>
        </a>

        <a class="sup-nav-link" routerLink="/superviseur/ressources" routerLinkActive="active">
          <span class="sup-nav-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
            </svg>
          </span>
          <span class="sup-nav-label">Ressources</span>
        </a>

        <a class="sup-nav-link" routerLink="/superviseur/capteurs" routerLinkActive="active">
          <span class="sup-nav-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </span>
          <span class="sup-nav-label">Capteurs IoT</span>
        </a>

        <a class="sup-nav-link" routerLink="/superviseur/acteurs" routerLinkActive="active">
          <span class="sup-nav-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </span>
          <span class="sup-nav-label">Acteurs &amp; équipe</span>
          <span *ngIf="nbActeurs" class="sup-nav-count">{{ nbActeurs }}</span>
        </a>

      </nav>

      <div class="sup-sidebar-footer">
        <button type="button" class="sup-logout-btn" (click)="logout()">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Déconnexion
        </button>
      </div>

    </aside>

    <!-- CONTENT -->
    <main class="sup-content">
      <router-outlet></router-outlet>
    </main>

  </div>

  <!-- Overlay « recensement » : on réutilise les pages Ressources/Infrastructures TELLES QUELLES,
       montées par-dessus la carte et pilotées par RecensementService. Le scope (département) reste
       verrouillé via [scope]. À la fermeture du wizard, on rend la main → l'utilisateur reste sur la carte. -->
  <ng-container *ngIf="recensement.mode() as m">
    <app-resources-page *ngIf="m === 'ressource'"
        [scope]="autoScope" [overlayMode]="true" [initialCoords]="recensement.coords()"
        (overlayClose)="recensement.fermer()"></app-resources-page>
    <app-infrastructures-page *ngIf="m === 'ouvrage'"
        [scope]="autoScope" [overlayMode]="true" [initialCoords]="recensement.coords()"
        (overlayClose)="recensement.fermer()"></app-infrastructures-page>
  </ng-container>

  <!-- Modale de création d'alerte PARTAGÉE (même que admin/terrain), montée dans le shell superviseur.
       Ouverte par le bouton « + Créer une alerte » de la page Alertes ; département verrouillé sur l'URD. -->
  <app-nouvelle-alerte *ngIf="alertes.modalCreerOuvert()" [presetDept]="autoScope?.dept"></app-nouvelle-alerte>

</section>
  `
})
export class SuperviseurLayoutComponent implements OnInit, OnDestroy {
  @ViewChild('userMenu') private readonly userMenu?: ElementRef<HTMLDetailsElement>;

  user: AuthUser | null = null;
  private userSub?: Subscription;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly scope: ScopeService,
    readonly alertes: AlerteStateService,
    private readonly rapports: RapportsStore,
    private readonly acteurs: ActeurStore,
    readonly recensement: RecensementService,
    readonly notif: NotificationService,
  ) {
    this.user = this.auth.userSnapshot();
    this.userSub = this.auth.userStream().subscribe(u => (this.user = u));
  }

  /** Scope du token (département) passé aux pages montées en overlay — verrou conservé. */
  get autoScope(): { dept: string; urdId?: string; commune?: string } | undefined {
    return this.scope.autoScope ?? undefined;
  }

  /** Charge alertes + rapports scopés dès l'entrée → les badges sont justes partout,
   *  pas seulement sur leur page. Listes et badges dérivent des mêmes stores. */
  ngOnInit(): void {
    const dept = this.scope.dept;
    if (dept) {
      this.alertes.charger(dept);
      this.rapports.charger(dept);
    }
  }

  /** Compteur live = nombre de cartes « à traiter » (jamais une valeur stockée à part). */
  get nbAlertesActives(): number {
    return this.alertes.nbATraiter();
  }

  /** Compteur live = rapports « à valider » (TRANSMIS), dérivé du même store. */
  get nbRapportsAValider(): number {
    return this.rapports.nbAValider();
  }

  /** Effectif de l'URD = acteurs du département (annuaire scopé), jamais un « 15 » figé.
   *  Le badge reflète exactement la liste qu'il ouvre (page Acteurs & équipe). */
  get nbActeurs(): number {
    return this.acteurs.forDept(this.scope.dept ?? undefined).length;
  }

  /** Libellé de l'URD dérivé du scope du token (ex. "URD Nord"). */
  get urdLabel(): string {
    const dept = this.user?.dept;
    if (dept) return 'URD ' + dept;
    const id = this.user?.urdId;
    return id ? id.replace(/^URD-/, 'URD ') : 'URD';
  }

  /** Nom affiché : le nom complet du profil, à défaut l'identifiant. */
  get displayName(): string {
    return this.user?.nom ?? this.user?.username ?? 'Responsable';
  }

  get userInitials(): string {
    const base = (this.user?.nom ?? this.user?.username ?? 'R').trim();
    const parts = base.split(/\s+/);
    const ini = parts.length > 1 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
    return ini.toUpperCase();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
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
  }
}
