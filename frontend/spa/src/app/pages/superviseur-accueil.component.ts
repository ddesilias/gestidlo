import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../auth.service';
import { BffApiService } from '../api/bff-api.service';
import { ScopeService } from '../scope.service';
import { ActeurStore } from '../acteur.store';
import { AlerteStateService } from './alertes/alerte-state.service';
import { isActive } from './alertes/alerte.types';

/**
 * Tableau de bord d'accueil du superviseur — une BOÎTE DE TÂCHES, pas une carte.
 *
 * Kelly se connecte avec une question crue : « qu'est-ce que je dois traiter
 * maintenant ? ». L'accueil répond d'abord par « ce qui vous attend » (urgences
 * non assignées en tête), puis les chiffres, puis un aperçu de carte.
 *
 * C'est un CONTENU qui vit dans la coquille sombre (header + sidebar fournis par
 * SuperviseurLayoutComponent) — pas une app-dans-l'app : une seule identité, un
 * seul thème, zéro bandeau bleu.
 *
 * Live aujourd'hui : le héros alertes (dérivé du store scopé, déjà câblé). Le reste
 * (rapports, KPI référentiel, techniciens) sont des placeholders démo, à brancher
 * sur le même patron que les alertes — repérés par `// DEMO`.
 */
@Component({
  selector: 'app-superviseur-accueil',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
<div class="acc">

  <!-- Salutation -->
  <header class="acc-hello">
    <h1 class="acc-hello__h1">Bonjour {{ prenom }}</h1>
    <p class="acc-hello__sub">
      URD {{ dept }} · département {{ dept }} · périmètre défini par DINEPA · {{ dateLabel }}
    </p>
  </header>

  <!-- Bandeau de sévérité : un seul comptage par gravité, dérivé de LA liste d'alertes
       scopée. « critique » ici = la même alerte que l'urgence du worklist et le pin rouge
       de la carte — trois endroits, une source. -->
  <section class="acc-sev">
    <a class="acc-sev__cell acc-sev__cell--red" routerLink="/superviseur/alertes">
      <div class="acc-sev__n">{{ nbCritiques() }}</div>
      <div class="acc-sev__l"><i class="ti ti-alert-octagon"></i> critique{{ nbCritiques() !== 1 ? 's' : '' }}</div>
    </a>
    <a class="acc-sev__cell acc-sev__cell--amber" routerLink="/superviseur/alertes">
      <div class="acc-sev__n">{{ nbUrgent() }}</div>
      <div class="acc-sev__l"><i class="ti ti-alert-triangle"></i> urgent{{ nbUrgent() !== 1 ? 's' : '' }}</div>
    </a>
    <a class="acc-sev__cell" routerLink="/superviseur/alertes">
      <div class="acc-sev__n">{{ nbSurveiller() }}</div>
      <div class="acc-sev__l"><i class="ti ti-eye"></i> à surveiller</div>
    </a>
  </section>

  <!-- CE QUI VOUS ATTEND -->
  <section class="acc-tasks">
    <div class="acc-tasks__head">
      <span class="acc-tasks__lbl">CE QUI VOUS ATTEND</span>
      <span class="acc-tasks__count">{{ nbActions() }} action{{ nbActions() !== 1 ? 's' : '' }}</span>
    </div>

    <!-- Rien à traiter -->
    <div *ngIf="nbActions() === 0" class="acc-task acc-task--calm">
      <i class="ti ti-circle-check"></i>
      <div class="acc-task__body"><div class="acc-task__title">Rien d'urgent pour le moment</div></div>
    </div>

    <!-- Urgence non assignée (héros) -->
    <a *ngIf="nbUrgencesNonAssignees() > 0" class="acc-task acc-task--red" routerLink="/superviseur/alertes">
      <i class="ti ti-alert-triangle acc-task__ico"></i>
      <div class="acc-task__body">
        <div class="acc-task__title">{{ nbUrgencesNonAssignees() }} urgence{{ nbUrgencesNonAssignees() !== 1 ? 's' : '' }} non assignée{{ nbUrgencesNonAssignees() !== 1 ? 's' : '' }}</div>
        <div class="acc-task__sub">{{ premiereUrgence() }} · aucun technicien</div>
      </div>
      <span class="acc-task__cta acc-task__cta--solid">Assigner</span>
    </a>

    <!-- Alertes à traiter -->
    <a *ngIf="nbAlertes() > 0" class="acc-task acc-task--amber" routerLink="/superviseur/alertes">
      <i class="ti ti-bell-ringing acc-task__ico acc-task__ico--amber"></i>
      <div class="acc-task__body">
        <div class="acc-task__title">{{ nbAlertes() }} alerte{{ nbAlertes() !== 1 ? 's' : '' }} à traiter</div>
        <div class="acc-task__sub">{{ nbCritiques() }} urgente{{ nbCritiques() !== 1 ? 's' : '' }} · périmètre {{ dept }}</div>
      </div>
      <span class="acc-task__cta">Ouvrir <i class="ti ti-arrow-right"></i></span>
    </a>

    <!-- Rapports à valider (scopé : GET /api/rapports?status=TRANSMIS, compteur = .length) -->
    <a *ngIf="nbRapports() > 0" class="acc-task acc-task--amber" routerLink="/superviseur/rapports">
      <i class="ti ti-file-check acc-task__ico acc-task__ico--amber"></i>
      <div class="acc-task__body">
        <div class="acc-task__title">{{ nbRapports() }} rapport{{ nbRapports() !== 1 ? 's' : '' }} à valider</div>
        <div class="acc-task__sub">{{ rapportsAuteurs() }}</div>
      </div>
      <span class="acc-task__cta">Valider <i class="ti ti-arrow-right"></i></span>
    </a>
  </section>

  <!-- Chiffres scopés : Communes, Points suivis et Techniciens dérivés de listes scopées
       (capteurs + annuaire des acteurs), jamais figés. Conformité / Réactivité restent des
       cibles indicatives (calcul métier à brancher) — affichées AVEC leur cible pour donner
       une direction plutôt qu'un chiffre passif. -->
  <section class="acc-kpis">
    <div class="acc-kpi"><div class="acc-kpi__lbl">Communes</div><div class="acc-kpi__val">{{ communesCouvertes() }}</div></div>
    <div class="acc-kpi"><div class="acc-kpi__lbl">Techniciens</div><div class="acc-kpi__val">{{ nbTechniciens() }}</div><div class="acc-kpi__sub">TEPAC · annuaire</div></div>
    <div class="acc-kpi"><div class="acc-kpi__lbl">Points suivis</div><div class="acc-kpi__val">{{ pointsSuivis() }}</div></div>
    <div class="acc-kpi"><div class="acc-kpi__lbl">Conformité</div><div class="acc-kpi__val acc-kpi__val--warn">61<span class="acc-kpi__suf">%</span></div><div class="acc-kpi__sub">cible 80 %</div></div>
    <div class="acc-kpi">
      <div class="acc-kpi__lbl">Réactivité 30j</div>
      <div class="acc-kpi__valrow">
        <span class="acc-kpi__val acc-kpi__val--ok">92<span class="acc-kpi__suf">%</span></span>
        <svg class="acc-spark" width="42" height="16" viewBox="0 0 42 16" aria-hidden="true"><polyline points="0,12 8,10 16,11 24,6 32,7 42,3" fill="none" stroke="#3fb950" stroke-width="1.5"/></svg>
      </div>
      <div class="acc-kpi__sub">cible 85 %</div>
    </div>
  </section>

  <!-- Carte + techniciens -->
  <section class="acc-grid">

    <a class="acc-card acc-card--map" routerLink="/superviseur/carte">
      <div class="acc-card__head">
        <span class="acc-card__lbl"><i class="ti ti-map-pin"></i> MA CARTE — {{ dept }}</span>
        <span class="acc-card__link">ouvrir →</span>
      </div>
      <div class="acc-map">
        <span class="acc-map__pin acc-map__pin--ok"   style="left:30%;top:40%"></span>
        <span class="acc-map__pin acc-map__pin--warn" style="left:55%;top:30%"></span>
        <span class="acc-map__pin acc-map__pin--red"  style="left:70%;top:60%"></span>
        <span class="acc-map__pin acc-map__pin--ok"   style="left:42%;top:65%"></span>
      </div>
      <div class="acc-map__legend">
        <span><i class="acc-dot acc-dot--ok"></i>OK {{ nbOk() }}</span>
        <span><i class="acc-dot acc-dot--warn"></i>Hors ligne {{ nbHorsLigne() }}</span>
        <span><i class="acc-dot acc-dot--red"></i>Urgent {{ nbSeuil() }}</span>
      </div>
    </a>

    <div class="acc-card">
      <div class="acc-card__head">
        <span class="acc-card__lbl"><i class="ti ti-users"></i> MES TECHNICIENS</span>
        <span class="acc-card__src">annuaire · live</span>
      </div>

      <!-- Roster réel : ActeurStore (annuaire scopé serveur via JWT), filtré TEPAC du
           département. Plus de cartes démo — la liste, son aperçu et le compteur du pied
           dérivent du même signal. -->
      <div *ngIf="rosterApercu().length > 0; else rosterVide">
        <div class="acc-tech" *ngFor="let t of rosterApercu()">
          <span class="acc-tech__av">{{ initiales(t.nom) }}</span>
          <span class="acc-tech__nom">{{ t.nom }}</span>
          <span class="acc-tech__st">{{ t.commune || dept }}</span>
        </div>
      </div>
      <ng-template #rosterVide>
        <div class="acc-tech acc-tech--vide">Aucun technicien enregistré sur le périmètre</div>
      </ng-template>

      <a class="acc-card__link acc-card__link--foot" routerLink="/superviseur/acteurs">
        voir {{ nbTechniciens() === 1 ? 'le technicien' : 'les ' + nbTechniciens() }} →
      </a>
    </div>

  </section>
</div>
  `,
  styles: [`
    .acc { color:#e6edf3; max-width:1080px; }

    .acc-hello { margin-bottom:14px; }
    .acc-hello__h1 { font-size:18px; font-weight:600; margin:0; color:#f5f7fa; }
    .acc-hello__sub { font-size:11px; color:#8b949e; margin:3px 0 0; }

    /* Bandeau de sévérité */
    .acc-sev { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px; }
    .acc-sev__cell { background:#161b22; border:1px solid rgba(255,255,255,.06); border-radius:8px;
      padding:9px 11px; text-decoration:none; color:#c9d1d9; transition:border-color .15s; }
    .acc-sev__cell:hover { border-color:rgba(255,255,255,.16); }
    .acc-sev__cell--red { background:rgba(226,75,74,.08); border-color:rgba(226,75,74,.20); color:#e24b4a; }
    .acc-sev__cell--amber { background:rgba(234,179,8,.08); border-color:rgba(234,179,8,.20); color:#eab308; }
    .acc-sev__n { font-size:22px; font-weight:500; line-height:1.1; }
    .acc-sev__l { font-size:11px; margin-top:1px; }
    .acc-sev__l i { font-size:12px; vertical-align:-1px; }

    /* Boîte de tâches */
    .acc-tasks { background:#11161f; border:1px solid rgba(255,255,255,.06); border-radius:10px; padding:12px; margin-bottom:14px; }
    .acc-tasks__head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .acc-tasks__lbl { font-size:11px; letter-spacing:.5px; color:#8b949e; }
    .acc-tasks__count { font-size:10px; color:#5b6470; }

    .acc-task { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:8px;
      background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.06); margin-bottom:7px;
      text-decoration:none; color:inherit; transition:background .15s, border-color .15s; }
    .acc-task:last-child { margin-bottom:0; }
    .acc-task:hover { background:rgba(255,255,255,.045); }
    .acc-task--red { background:rgba(226,75,74,.08); border-color:rgba(226,75,74,.20); }
    .acc-task--red:hover { background:rgba(226,75,74,.13); }
    .acc-task--calm { background:rgba(63,185,80,.06); border-color:rgba(63,185,80,.18); color:#3fb950; }
    .acc-task__ico { font-size:19px; color:#e24b4a; flex-shrink:0; }
    .acc-task__ico--amber { color:#eab308; }
    .acc-task__body { flex:1; line-height:1.3; min-width:0; }
    .acc-task__title { font-size:12px; }
    .acc-task__sub { font-size:10px; color:#8b949e; }
    .acc-task__cta { font-size:10px; color:#c9d1d9; border:1px solid rgba(255,255,255,.12); border-radius:6px; padding:4px 9px; white-space:nowrap; flex-shrink:0; }
    .acc-task__cta--solid { color:#04342c; background:#19c3a8; border-color:transparent; font-weight:500; }
    .acc-task__cta i { font-size:11px; vertical-align:-1px; }

    /* KPI */
    .acc-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(86px,1fr)); gap:8px; margin-bottom:14px; }
    .acc-kpi { background:#161b22; border-radius:8px; padding:9px 11px; }
    .acc-kpi__lbl { font-size:10px; color:#8b949e; }
    .acc-kpi__val { font-size:19px; font-weight:500; margin-top:2px; }
    .acc-kpi__suf { font-size:11px; color:#8b949e; }
    .acc-kpi__val--warn { color:#eab308; }
    .acc-kpi__val--ok { color:#3fb950; }
    .acc-kpi__sub { font-size:10px; color:#5b6470; margin-top:2px; }
    .acc-kpi__valrow { display:flex; align-items:baseline; gap:6px; }
    .acc-spark { overflow:visible; }

    /* Grid bas — carte et roster à parité (même cadre, même poids) */
    .acc-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    @media (max-width:720px) { .acc-grid { grid-template-columns:1fr; } }
    .acc-card { background:#11161f; border:1px solid rgba(255,255,255,.06); border-radius:10px; padding:11px 12px; min-width:0; text-decoration:none; color:inherit; display:block; }
    .acc-card--map:hover { border-color:rgba(25,195,168,.35); }
    .acc-card__head { display:flex; align-items:center; justify-content:space-between; margin-bottom:9px; }
    .acc-card__lbl { display:flex; align-items:center; gap:6px; font-size:11px; letter-spacing:.5px; color:#8b949e; }
    .acc-card__lbl i { font-size:14px; }
    .acc-card__link { font-size:10px; color:#19c3a8; }
    .acc-card__link--foot { display:inline-block; margin-top:6px; }
    .acc-card__src { font-size:10px; color:#5b6470; }

    .acc-map { height:96px; border-radius:8px; position:relative;
      background:repeating-linear-gradient(45deg,#0e141d,#0e141d 9px,#10171f 9px,#10171f 18px); }
    .acc-map__pin { position:absolute; width:9px; height:9px; border-radius:50%; border:2px solid #0a0e14; }
    .acc-map__pin--ok { background:#3fb950; } .acc-map__pin--warn { background:#eab308; } .acc-map__pin--red { background:#e24b4a; }
    .acc-map__legend { display:flex; gap:12px; margin-top:8px; font-size:10px; color:#8b949e; }
    .acc-dot { display:inline-block; width:7px; height:7px; border-radius:50%; margin-right:4px; }
    .acc-dot--ok { background:#3fb950; } .acc-dot--warn { background:#eab308; } .acc-dot--red { background:#e24b4a; }

    .acc-tech { display:flex; align-items:center; gap:8px; padding:5px 0; font-size:11px; border-top:1px solid rgba(255,255,255,.05); }
    .acc-tech:first-of-type { border-top:0; }
    .acc-tech__av { width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center;
      font-size:9px; background:rgba(139,148,158,.18); color:#8b949e; flex-shrink:0; }
    .acc-tech__av--ok { background:rgba(63,185,80,.18); color:#3fb950; }
    .acc-tech__av--red { background:rgba(226,75,74,.18); color:#e24b4a; }
    .acc-tech__nom { flex:1; }
    .acc-tech__st { font-size:10px; color:#8b949e; }
    .acc-tech__st--ok { color:#3fb950; } .acc-tech__st--red { color:#e24b4a; }
    .acc-tech--vide { color:#5b6470; font-size:11px; padding:8px 0; }
  `],
})
export class SuperviseurAccueilComponent implements OnInit {
  private readonly auth     = inject(AuthService);
  private readonly bff      = inject(BffApiService);
  private readonly scope    = inject(ScopeService);
  private readonly alertes  = inject(AlerteStateService);
  private readonly acteurs  = inject(ActeurStore);

  // ── Live (store alertes scopé) ───────────────────────────────────────
  readonly nbAlertes   = computed(() => this.alertes.nbATraiter());
  readonly nbCritiques = computed(() => this.alertes.kpis().critiques);

  // ── Bandeau de sévérité : même liste scopée, ventilée par gravité.
  // « urgent » = haute ; « à surveiller » = moyenne + basse ; tous actifs uniquement.
  readonly nbUrgent = computed(() =>
    this.alertes.toutesLesAlertes().filter(a => a.severity === 'haute' && isActive(a.status)).length);
  readonly nbSurveiller = computed(() =>
    this.alertes.toutesLesAlertes().filter(a =>
      (a.severity === 'moyenne' || a.severity === 'basse') && isActive(a.status)).length);

  readonly urgencesNonAssignees = computed(() =>
    this.alertes.toutesLesAlertes().filter(a =>
      a.severity === 'critique' && isActive(a.status) && !a.interventionId && !a.assignment
    )
  );
  readonly nbUrgencesNonAssignees = computed(() => this.urgencesNonAssignees().length);
  readonly premiereUrgence = computed(() =>
    this.urgencesNonAssignees()[0]?.infrastructureName
      ?? this.urgencesNonAssignees()[0]?.commune
      ?? 'Point non assigné'
  );

  // ── Rapports à valider : scopé serveur (GET /api/rapports?status=TRANSMIS). ──
  // Même source que la page Rapports → le compteur = .length, jamais un nombre figé.
  private readonly rapports = signal<any[]>([]);
  readonly nbRapports = computed(() => this.rapports().length);
  readonly rapportsAuteurs = computed(() => {
    const noms = [...new Set(this.rapports().map(r => r.auteur).filter(Boolean))] as string[];
    return noms.length ? noms.slice(0, 3).join(' · ') : 'en attente de validation';
  });

  // ── Capteurs scopés : source unique des chiffres « Communes / Points / carte ». ─
  private readonly capteurs = signal<any[]>([]);
  readonly pointsSuivis = computed(() => this.capteurs().length);
  readonly communesCouvertes = computed(() =>
    new Set(this.capteurs().map(c => c.commune).filter(Boolean)).size);
  readonly nbOk        = computed(() => this.capteurs().filter(c => c.etat === 'ok').length);
  readonly nbHorsLigne = computed(() => this.capteurs().filter(c => c.etat === 'hors-ligne').length);
  readonly nbSeuil     = computed(() => this.capteurs().filter(c => c.etat === 'seuil').length);

  readonly nbActions = computed(() =>
    (this.nbUrgencesNonAssignees() > 0 ? 1 : 0)
    + (this.nbAlertes() > 0 ? 1 : 0)
    + (this.nbRapports() > 0 ? 1 : 0)
  );

  // ── Roster réel : annuaire scopé serveur (JWT), filtré TEPAC du département. ──
  // Le compteur de techniciens, l'aperçu et le lien du pied dérivent du même signal —
  // plus de « 15 » figé ni de cartes démo.
  readonly techniciens = computed(() =>
    this.acteurs.items().filter(a => a.type === 'TEPAC' && a.departementId === this.scope.dept));
  readonly nbTechniciens = computed(() => this.techniciens().length);
  readonly rosterApercu  = computed(() => this.techniciens().slice(0, 3));

  initiales(nom: string): string {
    const p = (nom ?? '').trim().split(/\s+/);
    return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '—';
  }

  // ── Identité / scope ─────────────────────────────────────────────────
  get prenom(): string {
    const nom = this.auth.userSnapshot()?.nom ?? '';
    return nom.trim().split(/\s+/)[0] || 'Responsable';
  }
  get dept(): string { return this.scope.dept ?? '—'; }

  get dateLabel(): string {
    const d = new Date();
    const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
    const heure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d);
    return `${date}, ${heure}`;
  }

  /** Recharge les alertes scopées à l'entrée (restaure après reload — même patron). */
  ngOnInit(): void {
    const d = this.scope.dept;
    if (d) this.alertes.charger(d);
    // Scopés par le serveur depuis le JWT (inutile de passer le département).
    this.bff.capteurs().subscribe(list => this.capteurs.set(list ?? []));
    // Rapports à valider = TRANSMIS du périmètre, hors rapports nationaux (même règle que la file).
    this.bff.listRapports(undefined, 'TRANSMIS').subscribe(list =>
      this.rapports.set((list ?? []).filter(r => !r.national)));
  }
}
