import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ScopeService } from '../scope.service';
import { AuthService } from '../auth.service';
import { InboxCardComponent } from '../ui/inbox-card.component';
import { AlerteStateService } from './alertes/alerte-state.service';
import { AlertSeverity, GestAlert } from '../alert.store';

type Segment = 'a-traiter' | 'en-cours' | 'traitees' | 'toutes';

/**
 * Alertes à traiter — l'inbox de TRIAGE du superviseur.
 *
 * C'est ici que le contrat du store devient visible :
 *  - Tous les compteurs (bande KPI, pastilles de segment, badge sidebar) sont des
 *    `computed()` dérivés de la MÊME liste signal — jamais des champs stockés à part.
 *    Traiter une alerte (« ouverte → en-cours ») décrémente « à traiter » et incrémente
 *    « en cours » partout, tout seul. C'est la désync qu'on chasse.
 *  - Le scope vient du token (Sud-Est), imposé côté serveur — jamais le national.
 *  - Traiter = assigner un technicien + créer l'intervention : on PERSISTE d'abord
 *    (POST ticket dans le store), puis l'UI suit ; l'alerte quitte « à traiter » et
 *    réapparaît sous « en cours ». Une seule liste, deux sections selon le statut.
 *
 * DEMO : la liste des techniciens et la « Réactivité 30j » (placeholders, à brancher).
 */
@Component({
  selector: 'app-superviseur-alertes',
  standalone: true,
  imports: [CommonModule, FormsModule, InboxCardComponent],
  template: `
<div class="supa">

  <header class="supa-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
    <div>
      <h1 class="supa-head__h1">{{ estTepac ? 'Mes alertes' : 'Alertes à traiter' }}</h1>
      <p class="supa-head__sub">périmètre {{ dept }} · <span class="supa-live"><i></i>suivi en direct</span></p>
    </div>
    <button type="button" (click)="state.ouvrirModalCreer()"
      style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;padding:8px 14px;border-radius:8px;background:#10B981;border:0;color:#04231c;cursor:pointer;white-space:nowrap;">
      <i class="ti ti-plus" style="font-size:14px"></i> Créer une alerte
    </button>
  </header>

  <!-- Bande KPI — tout dérivé de la liste -->
  <section class="supa-kpis">
    <div class="supa-kpi"><div class="supa-kpi__lbl">À traiter</div><div class="supa-kpi__val supa-kpi__val--red">{{ state.nbATraiter() }}</div></div>
    <div class="supa-kpi"><div class="supa-kpi__lbl">Urgentes</div><div class="supa-kpi__val">{{ state.nbUrgentes() }}</div></div>
    <div class="supa-kpi"><div class="supa-kpi__lbl">En cours</div><div class="supa-kpi__val supa-kpi__val--amber">{{ state.nbEnCours() }}</div></div>
    <div class="supa-kpi"><div class="supa-kpi__lbl">Réactivité 30j</div><div class="supa-kpi__val supa-kpi__val--green">92<span class="supa-kpi__suf">%</span></div></div>
  </section>

  <!-- Segments -->
  <div class="supa-segs">
    <button class="supa-seg" [class.supa-seg--on]="segment() === 'a-traiter'" (click)="segment.set('a-traiter')">À traiter · {{ state.nbATraiter() }}</button>
    <button class="supa-seg" [class.supa-seg--on]="segment() === 'en-cours'"  (click)="segment.set('en-cours')">En cours · {{ state.nbEnCours() }}</button>
    <button class="supa-seg" [class.supa-seg--on]="segment() === 'traitees'"  (click)="segment.set('traitees')">Traitées · {{ state.nbTraitees() }}</button>
    <button class="supa-seg" [class.supa-seg--on]="segment() === 'toutes'"    (click)="segment.set('toutes')">Toutes · {{ toutes().length }}</button>
  </div>

  <ng-container [ngSwitch]="segment()">

    <!-- ── À TRAITER : triage composé ───────────────────────────── -->
    <ng-container *ngSwitchCase="'a-traiter'">

      <div *ngIf="aTraiter().length === 0" class="supa-empty">
        <i class="ti ti-circle-check"></i> Rien à traiter pour le moment
      </div>

      <app-inbox-card *ngFor="let a of aTraiter()" tone="danger">
        <i ibx-icon class="ti ti-alert-triangle" style="color:#e24b4a"></i>
        <div ibx-body>
          <div class="supa-card__title-row">
            <span class="supa-card__title">{{ a.title }}</span>
            <span *ngIf="a.severity === 'critique'" class="supa-tag supa-tag--urgent">URGENTE</span>
            <span class="supa-tag supa-tag--ghost">non assignée</span>
          </div>
          <div class="supa-card__prov"><i class="ti ti-cpu"></i> {{ provenance(a) }}</div>
          <div class="supa-card__meta">détectée {{ timeAgo(a.createdAt) }}<span *ngIf="a.sensorMeasuredValue != null"> · {{ a.sensorMeasuredValue }}{{ a.sensorUnit }} (seuil {{ a.sensorThreshold }}{{ a.sensorUnit }})</span></div>
        </div>
        <div ibx-actions class="supa-act">
          <span class="supa-card__act-lbl">Traiter :</span>
          <!-- Mêmes données scopées ; seules les ACTIONS changent selon le rôle (un composant). -->
          <ng-container *ngIf="!estTepac; else actionsTepac">
            <select class="supa-select" [(ngModel)]="selectedTech[a.id]" [name]="'tech-' + a.id">
              <option [ngValue]="undefined" disabled selected>Assigner à un technicien</option>
              <option *ngFor="let t of techniciens" [ngValue]="t.id">{{ t.nom }}</option>
            </select>
            <button class="supa-btn" [disabled]="!selectedTech[a.id]" (click)="traiter(a)">
              <i class="ti ti-tool"></i> Créer l'intervention
            </button>
          </ng-container>
          <ng-template #actionsTepac>
            <button class="supa-btn" (click)="traiterTepac(a)"><i class="ti ti-tool"></i> Traiter</button>
            <button class="supa-btn" style="background:transparent;border:.5px solid rgba(255,255,255,.16);color:#e6edf3;"
                    (click)="escalader(a)"><i class="ti ti-arrow-up"></i> Escalader vers l'URD</button>
          </ng-template>
          <span class="supa-card__details">Détails →</span>
        </div>
      </app-inbox-card>

      <ng-container *ngIf="enCours().length">
        <div class="supa-subhead">EN COURS · POUR SURVEILLANCE</div>
        <div *ngFor="let a of enCours()" class="supa-row">
          <span class="supa-dot" [class.supa-dot--amber]="true"></span>
          <div class="supa-row__body">
            <div class="supa-row__title">{{ a.title }} <span class="supa-row__sev">· {{ severityLabel(a.severity) }}</span></div>
            <div class="supa-row__sub">{{ a.infrastructureName || '—' }}<span *ngIf="a.assignment"> · assignée à {{ a.assignment.technicianName }}</span> · {{ timeAgo(a.updatedAt) }}</div>
          </div>
          <span class="supa-chip supa-chip--amber">en cours</span>
        </div>
      </ng-container>

      <a *ngIf="state.nbTraitees()" class="supa-link" (click)="segment.set('traitees')">
        Voir les {{ state.nbTraitees() }} alertes traitées (30 j) →
      </a>
    </ng-container>

    <!-- ── Listes plates ────────────────────────────────────────── -->
    <ng-container *ngSwitchDefault>
      <div *ngIf="liste().length === 0" class="supa-empty">Aucune alerte dans ce segment</div>
      <div *ngFor="let a of liste()" class="supa-row">
        <span class="supa-dot" [ngClass]="dotClass(a)"></span>
        <div class="supa-row__body">
          <div class="supa-row__title">{{ a.title }} <span class="supa-row__sev">· {{ severityLabel(a.severity) }}</span></div>
          <div class="supa-row__sub">{{ a.infrastructureName || '—' }}<span *ngIf="a.assignment"> · {{ a.assignment.technicianName }}</span> · {{ timeAgo(a.updatedAt) }}</div>
        </div>
        <span class="supa-chip" [ngClass]="chipClass(a)">{{ statutLabel(a) }}</span>
      </div>
    </ng-container>

  </ng-container>
</div>
  `,
  styles: [`
    .supa { color:#e6edf3; max-width:1080px; }
    .supa-head { margin-bottom:12px; }
    .supa-head__h1 { font-size:16px; font-weight:500; margin:0; }
    .supa-head__sub { font-size:11px; color:#8b949e; margin:2px 0 0; }
    .supa-live { color:#3fb950; } .supa-live i { display:inline-block; width:6px; height:6px; border-radius:50%; background:#3fb950; margin-right:4px; vertical-align:1px; }

    .supa-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(86px,1fr)); gap:8px; margin-bottom:13px; }
    .supa-kpi { background:#161b22; border-radius:8px; padding:9px 11px; }
    .supa-kpi__lbl { font-size:10px; color:#8b949e; }
    .supa-kpi__val { font-size:19px; font-weight:500; margin-top:2px; }
    .supa-kpi__val--red { color:#e24b4a; } .supa-kpi__val--amber { color:#eab308; } .supa-kpi__val--green { color:#3fb950; }
    .supa-kpi__suf { font-size:11px; }

    .supa-segs { display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap; }
    .supa-seg { font-size:11px; color:#8b949e; background:transparent; border:1px solid rgba(255,255,255,.10); border-radius:20px; padding:4px 11px; cursor:pointer; font-family:inherit; }
    .supa-seg:hover { color:#c9d1d9; }
    .supa-seg--on { color:#5dd6c2; background:rgba(25,195,168,.14); border-color:rgba(25,195,168,.3); }

    .supa-empty { display:flex; align-items:center; gap:8px; font-size:12px; color:#3fb950;
      background:rgba(63,185,80,.06); border:1px solid rgba(63,185,80,.18); border-radius:10px; padding:14px; }

    /* Carte actionnable — le chrome (cadre, en-tête, rangée d'actions) vient de <app-inbox-card>.
       Ici, seulement le contenu projeté. */
    .supa-card__title-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .supa-card__title { font-size:13px; font-weight:500; }
    .supa-tag { font-size:9px; border-radius:20px; padding:2px 7px; }
    .supa-tag--urgent { color:#e24b4a; background:rgba(226,75,74,.15); }
    .supa-tag--ghost { color:#8b949e; border:1px solid rgba(255,255,255,.12); }
    .supa-card__prov { font-size:10px; color:#8b949e; margin-top:5px; }
    .supa-card__prov i { font-size:12px; vertical-align:-2px; margin-right:3px; }
    .supa-card__meta { font-size:10px; color:#8b949e; margin-top:3px; }
    /* Passe-plat : les enfants deviennent les items flex de .ibx__actions (le chrome). */
    .supa-act { display:contents; }
    .supa-card__act-lbl { font-size:10px; color:#8b949e; }
    .supa-select { font-size:11px; color:#c9d1d9; background:#0a0e14; border:1px solid rgba(255,255,255,.12);
      border-radius:7px; padding:5px 9px; font-family:inherit; outline:none; min-width:180px; }
    .supa-btn { font-size:11px; color:#04342c; background:#19c3a8; border:0; border-radius:7px; padding:5px 11px;
      cursor:pointer; font-family:inherit; }
    .supa-btn:disabled { opacity:.45; cursor:not-allowed; }
    .supa-btn i { font-size:12px; vertical-align:-2px; margin-right:3px; }
    .supa-card__details { font-size:11px; color:#8b949e; margin-left:auto; }

    .supa-subhead { font-size:10px; letter-spacing:.5px; color:#5b6470; margin:6px 0 8px; }

    /* Ligne compacte */
    .supa-row { display:flex; align-items:center; gap:10px; padding:9px 11px; border-radius:8px;
      background:#11161f; border:1px solid rgba(255,255,255,.06); margin-bottom:7px; }
    .supa-dot { width:7px; height:7px; border-radius:50%; background:#8b949e; flex-shrink:0; }
    .supa-dot--red { background:#e24b4a; } .supa-dot--amber { background:#eab308; } .supa-dot--green { background:#3fb950; }
    .supa-row__body { flex:1; min-width:0; line-height:1.3; }
    .supa-row__title { font-size:12px; }
    .supa-row__sev { font-size:9px; color:#8b949e; }
    .supa-row__sub { font-size:10px; color:#8b949e; }
    .supa-chip { font-size:10px; border-radius:6px; padding:3px 8px; flex-shrink:0; color:#8b949e; background:rgba(255,255,255,.05); }
    .supa-chip--amber { color:#eab308; background:rgba(234,179,8,.12); }
    .supa-chip--green { color:#3fb950; background:rgba(63,185,80,.12); }
    .supa-chip--red { color:#e24b4a; background:rgba(226,75,74,.12); }

    .supa-link { display:inline-block; font-size:10px; color:#19c3a8; margin-top:11px; cursor:pointer; }
  `],
})
export class SuperviseurAlertesComponent implements OnInit {
  readonly state = inject(AlerteStateService);
  private readonly scope = inject(ScopeService);
  private readonly auth = inject(AuthService);

  /** Même page pour l'URD et le TEPAC ; seul le rôle change l'intitulé (le scope vient du JWT). */
  get estTepac(): boolean { return this.auth.hasRole('TEPAC'); }

  readonly segment = signal<Segment>('a-traiter');

  // DEMO : à brancher sur l'équipe scopée
  readonly techniciens = [
    { id: 't-jp', nom: 'Jean P.' },
    { id: 't-mc', nom: 'Maria C.' },
    { id: 't-rd', nom: 'Robert D.' },
  ];
  selectedTech: Record<string, string> = {};

  get dept(): string { return this.scope.dept ?? '—'; }

  // ── Tout dérivé de la même liste scopée ──────────────────────────────
  readonly aTraiter = computed(() => this.state.toutesLesAlertes().filter(a => a.status === 'ouverte'));
  readonly enCours  = computed(() => this.state.toutesLesAlertes().filter(a => a.status === 'assignee' || a.status === 'en-cours'));
  readonly traitees = computed(() => this.state.toutesLesAlertes().filter(a => a.status === 'resolue' || a.status === 'archivee' || a.status === 'ignoree'));
  readonly toutes   = computed(() => this.state.toutesLesAlertes());

  /** Liste affichée pour les segments plats (en-cours / traitées / toutes). */
  readonly liste = computed(() => {
    switch (this.segment()) {
      case 'en-cours': return this.enCours();
      case 'traitees': return this.traitees();
      case 'toutes':   return this.toutes();
      default:         return this.aTraiter();
    }
  });

  traiter(a: GestAlert): void {
    const techId = this.selectedTech[a.id];
    const tech = this.techniciens.find(t => t.id === techId);
    if (!tech) return;
    this.state.traiter(a, { id: tech.id, nom: tech.nom });
    delete this.selectedTech[a.id];
  }

  /**
   * TEPAC : prend l'alerte en charge lui-même → crée une VRAIE intervention (ticket backend)
   * assignée à lui. C'est ce maillon qui débloque ensuite le rapport d'intervention dans le wizard
   * (la chaîne alerte → intervention → rapport). Réutilise `traiter` (qui POST le ticket).
   */
  traiterTepac(a: GestAlert): void {
    const u = this.auth.userSnapshot();
    this.state.traiter(a, { id: u?.username ?? 'tepac', nom: u?.nom ?? u?.username ?? 'Technicien' });
  }

  /** TEPAC : escalade vers l'URD (incrémente le niveau ; l'alerte reste visible côté superviseur). */
  escalader(a: GestAlert): void { this.state.escalader(a.id); }

  provenance(a: GestAlert): string {
    const src = (a.source ?? 'iot').toUpperCase();
    const capteur = a.sensorCode ? `capteur ${a.sensorCode}` : 'capteur';
    const infra = a.infrastructureName || '—';
    const lieu = a.commune || a.department || '—';
    return `${src} · ${capteur} → ${infra} → ${lieu}`;
  }

  timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 60) return `il y a ${Math.max(1, min)} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `il y a ${h} h`;
    return `il y a ${Math.floor(h / 24)} j`;
  }

  severityLabel(s: AlertSeverity): string {
    return { critique: 'critique', haute: 'élevée', moyenne: 'modérée', basse: 'faible' }[s] ?? s;
  }

  dotClass(a: GestAlert): string {
    if (a.status === 'resolue') return 'supa-dot--green';
    if (a.severity === 'critique' || a.severity === 'haute') return 'supa-dot--red';
    if (a.severity === 'moyenne') return 'supa-dot--amber';
    return '';
  }

  chipClass(a: GestAlert): string {
    if (a.status === 'resolue') return 'supa-chip--green';
    if (a.status === 'ouverte') return 'supa-chip--red';
    return 'supa-chip--amber';
  }

  statutLabel(a: GestAlert): string {
    return { ouverte: 'à traiter', assignee: 'assignée', 'en-cours': 'en cours',
             resolue: 'traitée', ignoree: 'ignorée', archivee: 'archivée' }[a.status] ?? a.status;
  }

  /** Recharge les alertes scopées à l'entrée (restaure après reload). */
  ngOnInit(): void {
    const d = this.scope.dept;
    if (d) this.state.charger(d);
  }
}
