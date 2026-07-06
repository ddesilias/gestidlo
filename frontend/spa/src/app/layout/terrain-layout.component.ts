import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnDestroy, ViewChild, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, AuthUser } from '../auth.service';
import { NotificationService } from '../notification.service';
import { AlerteStateService } from '../pages/alertes/alerte-state.service';
import { NouvelleAlerteComponent } from '../pages/alertes/nouvelle-alerte/nouvelle-alerte.component';
import { ClocheNotificationsComponent } from '../ui/cloche-notifications.component';

type Dispo = 'Disponible' | 'Occupé' | 'Hors service';

/**
 * Shell du technicien TEPAC (« GESTiDlo Terrain »). Même patron que le shell
 * superviseur : topbar + sidebar + <router-outlet>, utilisateur dérivé du token.
 * Toutes les pages terrain héritent de ce layout (on corrige une fois ici).
 * Protégé par terrainGuard (rôle TEPAC) côté routes.
 */
@Component({
  selector: 'app-terrain-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NouvelleAlerteComponent, ClocheNotificationsComponent],
  styles: [`
    .terr-shell { min-height:100vh; background:#080B14; overflow-x:hidden; font-family:-apple-system,system-ui,sans-serif; }

    /* ═══ TOPBAR ═══ */
    .terr-topbar {
      position:fixed; top:0; left:0; right:0; z-index:900; height:60px;
      display:flex; align-items:center; padding:0 1.25rem; gap:.75rem;
      background:rgba(8,11,20,.97); border-bottom:.5px solid rgba(96,165,250,.2);
      box-shadow:0 4px 20px rgba(0,0,0,.35);
    }
    .terr-tb-brand { display:flex; align-items:center; gap:.5rem; text-decoration:none; flex-shrink:0; }
    .terr-tb-brand-name { font-size:.9rem; font-weight:700; color:#fff; letter-spacing:-.02em; }
    .terr-tb-accent { color:#60A5FA; }
    .terr-tb-ctx {
      display:flex; align-items:center; gap:.5rem; padding:.3rem .75rem;
      background:rgba(96,165,250,.08); border:.5px solid rgba(96,165,250,.22); border-radius:999px;
    }
    .terr-tb-ctx-dot { width:6px; height:6px; border-radius:50%; background:#60A5FA; flex-shrink:0; box-shadow:0 0 6px rgba(96,165,250,.7); }
    .terr-tb-ctx-label { font-size:.72rem; font-weight:600; color:#60A5FA; letter-spacing:.04em; white-space:nowrap; }
    .terr-tb-spacer { flex:1; }

    /* Cloche */
    .terr-bell { position:relative; display:flex; color:rgba(255,255,255,.6); cursor:pointer; }
    .terr-bell-dot { position:absolute; top:-3px; right:-3px; width:7px; height:7px; border-radius:50%; background:#F87171; }
    .terr-bell-badge { position:absolute; top:-7px; right:-8px; min-width:15px; height:15px; padding:0 4px; border-radius:999px; background:#F87171; color:#fff; font-size:9px; font-weight:700; line-height:15px; text-align:center; }

    /* Disponibilité */
    .terr-dispo {
      display:flex; align-items:center; gap:6px; padding:5px 12px; border-radius:999px;
      border:.5px solid; font-size:.74rem; font-weight:600; cursor:pointer; font-family:inherit;
      background:transparent;
    }
    .terr-dispo-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
    .terr-dispo--dispo    { color:#34D399; border-color:rgba(52,211,153,.4);  background:rgba(52,211,153,.1); }
    .terr-dispo--dispo    .terr-dispo-dot { background:#34D399; }
    .terr-dispo--occupe   { color:#FBBF24; border-color:rgba(251,191,36,.4);  background:rgba(251,191,36,.1); }
    .terr-dispo--occupe   .terr-dispo-dot { background:#FBBF24; }
    .terr-dispo--hs       { color:#F87171; border-color:rgba(248,113,113,.4); background:rgba(248,113,113,.1); }
    .terr-dispo--hs       .terr-dispo-dot { background:#F87171; }

    /* Profil */
    .terr-profile { position:relative; list-style:none; }
    .terr-profile summary { list-style:none; outline:none; }
    .terr-profile summary::-webkit-details-marker { display:none; }
    .terr-profile-trigger {
      display:flex; align-items:center; gap:.5rem; padding:4px; border-radius:999px; cursor:pointer;
      background:rgba(255,255,255,.04); border:.5px solid rgba(255,255,255,.1); transition:background .15s;
    }
    .terr-profile-trigger:hover { background:rgba(255,255,255,.09); }
    .terr-avatar {
      width:30px; height:30px; border-radius:50%; flex-shrink:0;
      background:linear-gradient(135deg,#3B82F6,#60A5FA); color:#fff; font-size:.78rem; font-weight:700;
      display:flex; align-items:center; justify-content:center;
    }
    @keyframes terr-panel-in { from { opacity:0; transform:translateY(-6px) scale(.97); } to { opacity:1; transform:none; } }
    .terr-profile[open] .terr-profile-panel { display:block; }
    .terr-profile-panel {
      display:none; position:absolute; top:calc(100% + .5rem); right:0; min-width:200px;
      background:#111827; border-radius:12px; border:.5px solid rgba(255,255,255,.1);
      box-shadow:0 16px 48px rgba(0,0,0,.55); z-index:500; overflow:hidden; animation:terr-panel-in .14s ease;
    }
    .terr-panel-header { display:flex; align-items:center; gap:.65rem; padding:.85rem 1rem; border-bottom:.5px solid rgba(255,255,255,.08); }
    .terr-panel-avatar {
      width:36px; height:36px; border-radius:50%; flex-shrink:0;
      background:linear-gradient(135deg,#3B82F6,#60A5FA); color:#fff; font-size:.88rem; font-weight:700;
      display:flex; align-items:center; justify-content:center;
    }
    .terr-panel-name { font-size:.84rem; font-weight:600; color:#e2e8f0; line-height:1.2; }
    .terr-panel-role { font-size:.7rem; color:rgba(255,255,255,.42); display:block; margin-top:.1rem; }
    .terr-panel-action {
      width:100%; padding:.62rem 1rem; border:0; background:transparent; text-align:left;
      font-size:.82rem; font-weight:500; color:#F87171; cursor:pointer; display:flex; align-items:center; gap:.5rem; font-family:inherit; transition:background .15s;
    }
    .terr-panel-action:hover { background:rgba(239,68,68,.08); }

    /* ═══ SIDEBAR ═══ */
    .terr-main { padding-left:220px; padding-top:60px; min-height:100vh; }
    .terr-sidebar {
      position:fixed; left:0; top:60px; height:calc(100vh - 60px); width:220px; z-index:800;
      display:flex; flex-direction:column; background:rgba(8,11,20,.97); border-right:.5px solid rgba(96,165,250,.1); overflow:hidden;
    }
    .terr-id-card {
      display:flex; align-items:center; gap:.65rem; padding:14px;
      background:rgba(96,165,250,.06); border-bottom:.5px solid rgba(96,165,250,.12); flex-shrink:0;
    }
    .terr-id-avatar {
      width:36px; height:36px; border-radius:50%; flex-shrink:0;
      background:linear-gradient(135deg,#3B82F6,#60A5FA); color:#fff; font-size:.85rem; font-weight:700;
      display:flex; align-items:center; justify-content:center;
    }
    .terr-id-name { font-size:.82rem; font-weight:600; color:#F5F7FA; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .terr-id-role { font-size:.68rem; color:#60A5FA; margin-top:2px; white-space:nowrap; }

    .terr-nav { flex:1; overflow-y:auto; padding:.5rem .75rem; display:flex; flex-direction:column; gap:2px; }
    .terr-nav::-webkit-scrollbar { width:3px; }
    .terr-nav::-webkit-scrollbar-thumb { background:rgba(255,255,255,.08); border-radius:2px; }
    .terr-nav-link {
      display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:8px;
      color:rgba(255,255,255,.52); text-decoration:none; font-size:.835rem; font-weight:500;
      transition:background .15s,color .15s; white-space:nowrap; position:relative; overflow:hidden;
    }
    .terr-nav-link:hover { background:rgba(255,255,255,.05); color:rgba(255,255,255,.82); }
    .terr-nav-link.active { background:linear-gradient(90deg,rgba(96,165,250,.16),rgba(96,165,250,.02)); color:#fff; }
    .terr-nav-link.active::before {
      content:''; position:absolute; left:0; top:7px; bottom:7px; width:3px;
      background:linear-gradient(180deg,#60A5FA,#3B82F6); border-radius:0 2px 2px 0; box-shadow:0 0 8px rgba(96,165,250,.65);
    }
    .terr-nav-icon { width:28px; height:28px; border-radius:7px; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:rgba(255,255,255,.32); transition:color .15s; font-size:16px; }
    .terr-nav-link:hover  .terr-nav-icon { color:rgba(255,255,255,.65); }
    .terr-nav-link.active .terr-nav-icon { color:#60A5FA; }
    .terr-nav-label { flex:1; }
    .terr-nav-badge { font-size:.62rem; font-weight:700; padding:.1rem .42rem; border-radius:999px; margin-left:auto; flex-shrink:0; line-height:1.4; }
    .terr-nav-badge--red   { background:rgba(239,68,68,.15); color:#F87171; border:.5px solid rgba(239,68,68,.3); }
    .terr-nav-badge--amber { background:rgba(251,191,36,.12); color:#FBBF24; border:.5px solid rgba(251,191,36,.25); }
    .terr-nav-link--soon { opacity:.4; cursor:default; }
    .terr-nav-link--soon:hover { background:transparent; color:rgba(255,255,255,.52); }
    .terr-nav-link--soon:hover .terr-nav-icon { color:rgba(255,255,255,.32); }
    /* Entrées du menu court : visibles comme le wireframe, inertes tant que la page n'existe pas. */
    .terr-nav-link--wip { cursor:default; }
    .terr-soon { font-size:9px; letter-spacing:.04em; margin-left:auto; color:#5b6470; flex-shrink:0; }

    .terr-sidebar-footer { flex-shrink:0; padding:10px 12px; border-top:.5px solid rgba(255,255,255,.06); }
    .terr-logout-btn {
      width:100%; display:flex; align-items:center; gap:9px; padding:9px 10px; border-radius:8px;
      background:transparent; border:0; color:rgba(255,255,255,.35); font-size:.82rem; font-weight:500;
      cursor:pointer; font-family:inherit; transition:background .15s,color .15s; text-align:left;
    }
    .terr-logout-btn:hover { background:rgba(239,68,68,.08); color:#F87171; }

    .terr-content { padding:1.25rem 1.35rem; color:#E2E8EE; }
  `],
  template: `
<section class="terr-shell">

  <!-- TOPBAR -->
  <header class="terr-topbar">
    <a class="terr-tb-brand" routerLink="/terrain/tableau-de-bord">
      <i class="ti ti-droplet" style="font-size:20px;color:#60A5FA"></i>
      <span class="terr-tb-brand-name">GEST<span class="terr-tb-accent">IDLO</span> Terrain</span>
    </a>
    <div class="terr-tb-ctx">
      <span class="terr-tb-ctx-dot"></span>
      <span class="terr-tb-ctx-label">TERRITOIRE · {{ territoireLabel }}</span>
    </div>
    <div class="terr-tb-spacer"></div>

    <app-cloche-notifications></app-cloche-notifications>

    <button type="button" class="terr-dispo" [ngClass]="dispoClass()" (click)="cycleDispo()">
      <span class="terr-dispo-dot"></span>{{ dispo() }}
    </button>

    <details class="terr-profile" #userMenu>
      <summary class="terr-profile-trigger">
        <div class="terr-avatar">{{ userInitials }}</div>
      </summary>
      <div class="terr-profile-panel">
        <div class="terr-panel-header">
          <div class="terr-panel-avatar">{{ userInitials }}</div>
          <div>
            <div class="terr-panel-name">{{ displayName }}</div>
            <span class="terr-panel-role">TEPAC · {{ territoireLabel }}</span>
          </div>
        </div>
        <button type="button" class="terr-panel-action" (click)="logout()">
          <i class="ti ti-logout" style="font-size:14px"></i> Se déconnecter
        </button>
      </div>
    </details>
  </header>

  <!-- BODY -->
  <div class="terr-main">

    <aside class="terr-sidebar">
      <div class="terr-id-card">
        <div class="terr-id-avatar">{{ userInitials }}</div>
        <div>
          <div class="terr-id-name">{{ displayName }}</div>
          <div class="terr-id-role">TEPAC · {{ territoireLabel }}</div>
        </div>
      </div>

      <nav class="terr-nav">
        <a class="terr-nav-link" routerLink="/terrain/tableau-de-bord" routerLinkActive="active">
          <span class="terr-nav-icon"><i class="ti ti-layout-dashboard"></i></span>
          <span class="terr-nav-label">Tableau de bord</span>
        </a>

        <!-- Menu court orienté action — pages PARTAGÉES avec l'URD, scopées commune par le JWT. -->
        <a class="terr-nav-link" routerLink="/terrain/alertes" routerLinkActive="active"><span class="terr-nav-icon"><i class="ti ti-bell"></i></span><span class="terr-nav-label">Mes alertes</span></a>
        <a class="terr-nav-link" routerLink="/terrain/interventions" routerLinkActive="active"><span class="terr-nav-icon"><i class="ti ti-tool"></i></span><span class="terr-nav-label">Interventions</span></a>
        <a class="terr-nav-link" routerLink="/terrain/ressources" routerLinkActive="active"><span class="terr-nav-icon"><i class="ti ti-droplet"></i></span><span class="terr-nav-label">Ressources</span></a>
        <a class="terr-nav-link" routerLink="/terrain/infrastructures" routerLinkActive="active"><span class="terr-nav-icon"><i class="ti ti-building-community"></i></span><span class="terr-nav-label">Infrastructures</span></a>
        <a class="terr-nav-link" routerLink="/terrain/capteurs" routerLinkActive="active"><span class="terr-nav-icon"><i class="ti ti-cpu"></i></span><span class="terr-nav-label">Capteurs IoT</span></a>
        <a class="terr-nav-link" routerLink="/terrain/rapports" routerLinkActive="active"><span class="terr-nav-icon"><i class="ti ti-file-text"></i></span><span class="terr-nav-label">Mes rapports</span></a>
      </nav>

      <div class="terr-sidebar-footer">
        <button type="button" class="terr-logout-btn" (click)="logout()">
          <i class="ti ti-logout" style="font-size:14px"></i> Déconnexion
        </button>
      </div>
    </aside>

    <main class="terr-content">
      <router-outlet></router-outlet>
    </main>

  </div>

  <!-- Modale de création d'alerte PARTAGÉE, montée dans le shell terrain (comme admin/superviseur).
       Ouverte par le bouton « Signaler » du dashboard ; commune verrouillée sur celle du TEPAC (JWT). -->
  <app-nouvelle-alerte *ngIf="alerteState.modalCreerOuvert()"></app-nouvelle-alerte>
</section>
  `
})
export class TerrainLayoutComponent implements OnDestroy {
  @ViewChild('userMenu') private readonly userMenu?: ElementRef<HTMLDetailsElement>;

  user: AuthUser | null = null;
  private readonly userSub: Subscription;

  /** Disponibilité — local pour l'instant ; à câbler sur PATCH /api/tepacs/{id}/disponibilite. */
  readonly dispo = signal<Dispo>('Disponible');

  constructor(private readonly auth: AuthService, private readonly router: Router,
              readonly notif: NotificationService, readonly alerteState: AlerteStateService) {
    this.user = this.auth.userSnapshot();
    this.userSub = this.auth.userStream().subscribe(u => (this.user = u));
  }

  /** Territoire affiché : commune du TEPAC · URD (département), sinon le département seul.
   * Le périmètre vient du token (JWT) — jamais sélectionnable côté front. */
  get territoireLabel(): string {
    const commune = this.user?.commune;
    const dept = this.user?.dept;
    if (commune) return dept ? `${commune} · URD ${dept}` : commune;
    return dept ?? 'Territoire';
  }

  get displayName(): string {
    return this.user?.nom ?? this.user?.username ?? 'Technicien';
  }

  get userInitials(): string {
    const base = (this.user?.nom ?? this.user?.username ?? 'T').trim();
    const parts = base.split(/\s+/);
    const ini = parts.length > 1 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
    return ini.toUpperCase();
  }

  dispoClass(): string {
    return { 'Disponible': 'terr-dispo--dispo', 'Occupé': 'terr-dispo--occupe', 'Hors service': 'terr-dispo--hs' }[this.dispo()];
  }

  cycleDispo(): void {
    const order: Dispo[] = ['Disponible', 'Occupé', 'Hors service'];
    this.dispo.update(d => order[(order.indexOf(d) + 1) % order.length]);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target) return;
    if (this.userMenu?.nativeElement.open && !this.userMenu.nativeElement.contains(target)) {
      this.userMenu.nativeElement.open = false;
    }
  }

  ngOnDestroy(): void { this.userSub.unsubscribe(); }
}
