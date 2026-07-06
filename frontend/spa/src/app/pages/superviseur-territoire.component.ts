import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { ScopeService } from '../scope.service';
import { BffApiService, ZoneDto } from '../api/bff-api.service';

interface CommuneRow { nom: string; couverture: number | null; }

/**
 * Territoire & communes — le RÉFÉRENTIEL territorial du superviseur (≠ « Ma carte »,
 * qui est l'opérationnel temps réel). Communes, sections, couverture, activation de zone.
 *
 * Scopé par construction au département du token : périmètre verrouillé, les filtres
 * raffinent DEDANS. « Activer une zone » est une écriture — son garde-fou serveur
 * (ST_Intersects geom_zone × département du token) attend une entité Zone côté backend.
 *
 * NOTE : vue focalisée scopée. La vraie réutilisation du module Référentiel admin
 * (TerritoireComponent) exige de le rendre scope-aware d'abord (il agrège le national).
 * DEMO : les chiffres de couverture (pas de couverture par commune en base).
 */
@Component({
  selector: 'app-superviseur-territoire',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="supt">

  <div class="supt-top">
    <div>
      <h1 class="supt-h1">Territoire &amp; communes</h1>
      <p class="supt-sub">
        <i class="ti ti-lock"></i> {{ dept }} · {{ communes().length }} communes · {{ zonesActives() }} zones actives · périmètre verrouillé
      </p>
    </div>
    <button class="supt-activer" type="button" (click)="toggleForm()">
      <i class="ti ti-plus"></i> Activer une zone
    </button>
  </div>

  <!-- Activation de zone — département verrouillé sur le token, vérifié serveur -->
  <div *ngIf="showForm()" class="supt-form">
    <input class="supt-input" [(ngModel)]="formNom" placeholder="Nom de la zone…" />
    <select class="supt-input" [(ngModel)]="formCommune">
      <option [ngValue]="''" disabled>Commune…</option>
      <option *ngFor="let c of communes()" [ngValue]="c.nom">{{ c.nom }}</option>
    </select>
    <span class="supt-form__lock"><i class="ti ti-lock"></i> {{ dept }}</span>
    <button class="supt-activer" [disabled]="!formNom.trim() || !formCommune" (click)="activer()">Activer</button>
    <button class="supt-cancel" (click)="showForm.set(false)">Annuler</button>
    <span *ngIf="formMsg()" class="supt-msg">{{ formMsg() }}</span>
  </div>

  <section class="supt-kpis">
    <div class="supt-kpi"><div class="supt-kpi__lbl">Couverture</div><div class="supt-kpi__val supt-kpi__val--amber">{{ couvertureMoy() }}<span class="supt-kpi__suf">%</span></div></div>
    <div class="supt-kpi"><div class="supt-kpi__lbl">Communes</div><div class="supt-kpi__val">{{ nbActives() }}<span class="supt-kpi__suf">/{{ communes().length }}</span></div></div>
    <div class="supt-kpi"><div class="supt-kpi__lbl">Pop. desservie</div><div class="supt-kpi__val">{{ popDesservie().val }}<span class="supt-kpi__suf" *ngIf="popDesservie().suf"> {{ popDesservie().suf }}</span></div></div>
    <div class="supt-kpi"><div class="supt-kpi__lbl">Zones critiques</div><div class="supt-kpi__val supt-kpi__val--red">{{ nbCritiques() }}</div></div>
  </section>

  <div class="supt-grid">

    <div class="supt-card">
      <div class="supt-card__head">
        <span class="supt-card__lbl">{{ communes().length }} COMMUNES</span>
      </div>
      <div *ngFor="let c of communes()" class="supt-comm">
        <i class="ti ti-chevron-right supt-comm__chev"></i>
        <span class="supt-dot" [ngClass]="dotClass(c)"></span>
        <span class="supt-comm__nom" [class.supt-comm__nom--muted]="c.couverture === null">{{ c.nom }}</span>
        <span class="supt-comm__cov" [ngClass]="covClass(c)">{{ covLabel(c) }}</span>
      </div>
    </div>

    <div class="supt-map">
      <div class="supt-map__chip">centrée sur le {{ dept }} · verrouillé</div>
      <div class="supt-map__hint"><i class="ti ti-map-2"></i> choroplèthe de couverture · communes &amp; sections</div>
    </div>

  </div>
</div>
  `,
  styles: [`
    .supt { color:#e6edf3; max-width:1080px; }
    .supt-top { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
    .supt-h1 { font-size:16px; font-weight:500; margin:0; }
    .supt-sub { font-size:11px; color:#8b949e; margin:2px 0 0; }
    .supt-sub i { font-size:12px; vertical-align:-2px; margin-right:3px; color:#19c3a8; }
    .supt-activer { font-size:11px; color:#04342c; background:#19c3a8; border:0; border-radius:7px; padding:6px 11px; font-weight:500; cursor:pointer; font-family:inherit; }
    .supt-activer i { font-size:13px; vertical-align:-2px; margin-right:3px; }
    .supt-activer:disabled { opacity:.45; cursor:not-allowed; }

    .supt-form { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:13px;
      background:#11161f; border:1px solid rgba(25,195,168,.25); border-radius:10px; padding:10px 12px; }
    .supt-input { font-size:11px; color:#c9d1d9; background:#0a0e14; border:1px solid rgba(255,255,255,.12);
      border-radius:7px; padding:5px 9px; font-family:inherit; outline:none; min-width:160px; }
    .supt-form__lock { font-size:10px; color:#19c3a8; }
    .supt-form__lock i { font-size:12px; vertical-align:-2px; margin-right:2px; }
    .supt-cancel { font-size:11px; color:#8b949e; background:transparent; border:1px solid rgba(255,255,255,.12); border-radius:7px; padding:5px 10px; cursor:pointer; font-family:inherit; }
    .supt-msg { font-size:10px; color:#F87171; }

    .supt-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(94px,1fr)); gap:8px; margin-bottom:13px; }
    .supt-kpi { background:#161b22; border-radius:8px; padding:9px 11px; }
    .supt-kpi__lbl { font-size:10px; color:#8b949e; }
    .supt-kpi__val { font-size:19px; font-weight:500; margin-top:2px; }
    .supt-kpi__suf { font-size:11px; color:#8b949e; }
    .supt-kpi__val--amber { color:#eab308; } .supt-kpi__val--red { color:#e24b4a; }

    .supt-grid { display:grid; grid-template-columns:.82fr 1.18fr; gap:12px; }
    @media (max-width:720px) { .supt-grid { grid-template-columns:1fr; } }

    .supt-card { background:#11161f; border:1px solid rgba(255,255,255,.06); border-radius:10px; padding:11px 12px; min-width:0; }
    .supt-card__head { margin-bottom:9px; }
    .supt-card__lbl { font-size:10px; letter-spacing:.5px; color:#5b6470; }
    .supt-comm { display:flex; align-items:center; gap:7px; padding:6px 0; font-size:11px; border-top:1px solid rgba(255,255,255,.05); }
    .supt-comm:first-of-type { border-top:0; }
    .supt-comm__chev { font-size:13px; color:#5b6470; }
    .supt-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
    .supt-dot--green { background:#3fb950; } .supt-dot--amber { background:#eab308; } .supt-dot--red { background:#e24b4a; } .supt-dot--muted { background:#5b6470; }
    .supt-comm__nom { flex:1; }
    .supt-comm__nom--muted { color:#8b949e; }
    .supt-comm__cov--green { color:#3fb950; } .supt-comm__cov--amber { color:#eab308; } .supt-comm__cov--red { color:#e24b4a; } .supt-comm__cov--muted { color:#8b949e; }

    .supt-map { background:#0e141b; border:1px solid rgba(255,255,255,.06); border-radius:10px; position:relative; min-height:230px; overflow:hidden; }
    .supt-map__chip { position:absolute; left:10px; bottom:10px; font-size:9px; color:#5b6470;
      background:rgba(10,14,20,.8); border:1px solid rgba(255,255,255,.1); border-radius:7px; padding:4px 9px; }
    .supt-map__hint { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:6px; font-size:11px; color:#5b6470; }
    .supt-map__hint i { font-size:16px; }
  `],
})
export class SuperviseurTerritoireComponent implements OnInit {
  private readonly scope = inject(ScopeService);
  private readonly bff = inject(BffApiService);

  // Zones réelles (scopées serveur). Le reste (couverture par commune) est encore DEMO.
  readonly zones = signal<ZoneDto[]>([]);
  readonly zonesActives = computed(() => this.zones().filter(z => z.statut === 'ACTIVE').length);

  /**
   * Pop. desservie = somme des populations cibles des zones ACTIVES du périmètre (donnée réelle,
   * scopée serveur) — plus de « 121 k » figé identique pour tous les superviseurs. Formatée en
   * milliers au-delà de 10 000 pour rester lisible.
   */
  readonly popDesservie = computed<{ val: string; suf: string }>(() => {
    const total = this.zones()
      .filter(z => z.statut === 'ACTIVE')
      .reduce((s, z) => s + (z.populationCible ?? 0), 0);
    if (total >= 10_000) return { val: (Math.round(total / 100) / 10).toLocaleString('fr-FR'), suf: 'k' };
    return { val: total.toLocaleString('fr-FR'), suf: '' };
  });

  readonly showForm = signal(false);
  readonly formMsg = signal('');
  formNom = '';
  formCommune = '';

  get dept(): string { return this.scope.dept ?? '—'; }

  // Communes RÉELLES du département du superviseur (scopées serveur par le token, jamais en dur).
  private readonly _communeNames = signal<string[]>([]);
  /** Couverture = nb de zones ACTIVES de la commune (donnée réelle, scopée). null ⇒ à déployer. */
  readonly communes = computed<CommuneRow[]>(() =>
    this._communeNames().map(nom => ({ nom, couverture: this.zonesActivesDe(nom) || null })));

  private zonesActivesDe(nom: string): number {
    return this.zones().filter(z => z.statut === 'ACTIVE'
      && (z.commune ?? '').toLowerCase() === nom.toLowerCase()).length;
  }

  nbActives(): number { return this.communes().filter(c => c.couverture !== null).length; }
  nbCritiques(): number { return this.communes().length - this.nbActives(); }
  couvertureMoy(): number {
    const total = this.communes().length;
    return total ? Math.round((this.nbActives() / total) * 100) : 0;
  }

  /** Libellé par commune : nb de zones actives, ou « à déployer ». */
  covLabel(c: CommuneRow): string {
    return c.couverture === null ? 'à déployer' : `${c.couverture} zone${c.couverture > 1 ? 's' : ''}`;
  }
  dotClass(c: CommuneRow): string { return 'supt-dot--' + this.tone(c); }
  covClass(c: CommuneRow): string { return 'supt-comm__cov--' + this.tone(c); }
  private tone(c: CommuneRow): string { return c.couverture === null ? 'muted' : 'green'; }

  ngOnInit(): void {
    // Communes du dept (scopé token) — corrige le bug « header Nord, liste Sud-Est ».
    this.bff.communes().pipe(catchError(() => of([] as { nom: string }[]))).subscribe(rows =>
      this._communeNames.set((rows ?? []).map(r => r.nom)));
    this.reload();
  }

  toggleForm(): void { this.showForm.update(v => !v); this.formMsg.set(''); }

  /** Activer une zone : POST scopé. Le serveur verrouille le département sur le token
   *  (403 si on forge un autre département) — l'écriture la plus sensible du superviseur. */
  activer(): void {
    if (!this.formNom.trim() || !this.formCommune) return;
    this.formMsg.set('');
    this.bff.activerZone({
      nom: this.formNom.trim(),
      commune: this.formCommune,
      departementId: this.scope.dept ?? '',
    }).pipe(
      catchError(err => {
        this.formMsg.set(err?.error?.message ?? err?.error?.detail ?? "Échec de l'activation");
        return of(null);
      }),
    ).subscribe(z => {
      if (z) { this.formNom = ''; this.formCommune = ''; this.showForm.set(false); this.reload(); }
    });
  }

  private reload(): void {
    this.bff.listZones(this.scope.dept ?? undefined).pipe(
      catchError(() => of([] as ZoneDto[])),
    ).subscribe(rows => this.zones.set(Array.isArray(rows) ? rows : []));
  }
}
