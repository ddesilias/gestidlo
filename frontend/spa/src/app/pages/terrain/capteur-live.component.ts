import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { interval, startWith, switchMap, catchError, of } from 'rxjs';

import { AuthService } from '../../auth.service';
import { BffApiService, CapteurDto } from '../../api/bff-api.service';

/**
 * Page « live » d'une STATION (vue technicien) — fidèle au wireframe château d'eau.
 *
 * Un CapteurEntity = UNE métrique ; ici on AGRÈGE les capteurs en périmètre (commune du TEPAC,
 * imposée par le token) en 4 cartes : Niveau, Débit, Pression, Pompe (dérivée du débit). La courbe
 * suit le niveau. Transport HYBRIDE : polling 4 s de `/api/iot/capteurs` (scopé serveur, isolation
 * JWT gratuite) ; l'alerte de seuil est créée côté serveur par `MeasurementService.ingest()`
 * (anti-doublon) et notifiée par le SSE des cloches — rien à refaire ici.
 */
@Component({
  selector: 'app-capteur-live',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
<div class="cl">

  <!-- Fil d'ariane : remonter à la liste des ouvrages -->
  <a class="cl-bc" [routerLink]="['../..']"><i class="ti ti-chevron-left"></i> Mes ouvrages</a>

  <!-- En-tête station -->
  <header class="cl-head">
    <div>
      <div class="cl-title">{{ stationNom() }}</div>
      <div class="cl-sub"><i class="ti ti-map-pin"></i> {{ stationCode() }} · URD {{ urd() }}</div>
    </div>
    <div class="cl-head-r">
      <span class="cl-online" [class.cl-online--off]="!enLigne()">
        <span class="cl-dot" [class.cl-dot--off]="!enLigne()"></span>{{ enLigne() ? 'En ligne' : 'Hors ligne' }}
      </span>
      <div class="cl-maj">{{ majLabel() }}</div>
    </div>
  </header>

  <!-- Bannière d'alerte (pire état des capteurs) -->
  <div class="cl-banner" [ngClass]="bannerClass()">
    <i class="ti" [ngClass]="bannerIcon()"></i>
    <span>{{ bannerText() }}</span>
  </div>

  <!-- 4 cartes métriques -->
  <div class="cl-grid">
    <div class="cl-card">
      <div class="cl-card__lbl"><i class="ti ti-droplet"></i> Niveau</div>
      <div class="cl-card__val" [ngClass]="critClass('NIVEAU')">{{ val('NIVEAU', '%') }}</div>
      <div class="cl-card__sub">seuil DINEPA 30 %</div>
    </div>
    <div class="cl-card">
      <div class="cl-card__lbl"><i class="ti ti-activity"></i> Débit</div>
      <div class="cl-card__val" [ngClass]="critClass('DEBIT')">{{ val('DEBIT', 'L/min') }}</div>
      <div class="cl-card__sub">conduite principale</div>
    </div>
    <div class="cl-card">
      <div class="cl-card__lbl"><i class="ti ti-gauge"></i> Pression</div>
      <div class="cl-card__val" [ngClass]="critClass('PRESSION')">{{ val('PRESSION', 'bar') }}</div>
      <div class="cl-card__sub">nominal 1,8–2,5</div>
    </div>
    <div class="cl-card">
      <div class="cl-card__lbl"><i class="ti ti-power"></i> Pompe</div>
      <div class="cl-card__val" [class.cl-card__val--ok]="pompeActive()">{{ pompeActive() ? 'Active' : 'Arrêt' }}</div>
      <div class="cl-card__sub">{{ pompeActive() ? 'en remplissage' : 'station de pompage' }}</div>
    </div>
  </div>

  <!-- Courbe niveau (sparkline SVG, buffer roulant) -->
  <div class="cl-chart-head">
    <span>Niveau du réservoir</span>
    <span class="cl-live"><span class="cl-dot"></span>flux temps réel</span>
  </div>
  <div class="cl-chart">
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" class="cl-svg">
      <!-- seuil 30 % -->
      <line x1="0" [attr.y1]="y(30)" x2="100" [attr.y2]="y(30)" stroke="#e24b4a" stroke-width="0.8" stroke-dasharray="3,2" vector-effect="non-scaling-stroke" />
      <polyline *ngIf="serie().length > 1" [attr.points]="polyline()" fill="none"
                [attr.stroke]="niveauCritique() ? '#f87171' : '#378add'" stroke-width="1.4" vector-effect="non-scaling-stroke" />
    </svg>
    <div *ngIf="serie().length < 2" class="cl-wait">En attente de mesures… (la courbe se remplit à chaque trame)</div>
  </div>

  <div class="cl-foot">
    <i class="ti ti-lock"></i> Données reçues du capteur (HTTP) · périmètre filtré selon votre rôle (JWT).
  </div>
</div>
  `,
  styles: [`
    .cl { color:#e6edf3; max-width:760px; }
    .cl-bc { display:inline-flex; align-items:center; gap:4px; font-size:12px; color:#8b949e; text-decoration:none; margin-bottom:10px; }
    .cl-bc:hover { color:#c9d1d9; } .cl-bc i { font-size:14px; }
    .cl-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,.08); }
    .cl-title { font-size:17px; font-weight:500; }
    .cl-sub { font-size:13px; color:#8b949e; margin-top:3px; } .cl-sub i { font-size:14px; vertical-align:-2px; }
    .cl-head-r { text-align:right; white-space:nowrap; }
    .cl-online { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:#3fb950; background:rgba(63,185,80,.12); padding:4px 10px; border-radius:999px; }
    .cl-online--off { color:#8b949e; background:rgba(255,255,255,.06); }
    .cl-dot { width:8px; height:8px; border-radius:50%; background:#3fb950; display:inline-block; animation:clpulse 1.4s infinite; }
    .cl-dot--off { background:#8b949e; animation:none; }
    @keyframes clpulse { 0%,100%{opacity:1} 50%{opacity:.3} }
    .cl-maj { font-size:12px; color:#6e7681; margin-top:5px; }

    .cl-banner { display:flex; align-items:center; gap:9px; margin-top:14px; padding:11px 13px; border-radius:9px; font-size:13px; }
    .cl-banner i { font-size:18px; }
    .cl-banner--ok { background:rgba(63,185,80,.1); color:#3fb950; }
    .cl-banner--warn { background:rgba(245,158,11,.12); color:#fbbf24; }
    .cl-banner--crit { background:rgba(248,113,113,.12); color:#f87171; }

    .cl-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:14px; }
    .cl-card { background:#161b22; border-radius:9px; padding:12px 14px; }
    .cl-card__lbl { display:flex; align-items:center; gap:6px; font-size:13px; color:#8b949e; }
    .cl-card__lbl i { font-size:16px; }
    .cl-card__val { font-size:24px; font-weight:500; margin-top:4px; }
    .cl-card__val--crit { color:#f87171; } .cl-card__val--warn { color:#fbbf24; } .cl-card__val--ok { color:#3fb950; }
    .cl-card__sub { font-size:12px; color:#6e7681; margin-top:2px; }

    .cl-chart-head { display:flex; align-items:center; justify-content:space-between; margin-top:18px; font-size:14px; font-weight:500; }
    .cl-live { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:#8b949e; font-weight:400; }
    .cl-chart { position:relative; height:165px; margin-top:6px; background:#0d1117; border:1px solid rgba(255,255,255,.06); border-radius:9px; padding:8px; }
    .cl-svg { width:100%; height:100%; display:block; }
    .cl-wait { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:12px; color:#6e7681; }

    .cl-foot { font-size:12px; color:#6e7681; margin-top:16px; padding-top:10px; border-top:1px solid rgba(255,255,255,.06); } .cl-foot i { font-size:13px; vertical-align:-2px; margin-right:4px; }
  `],
})
export class CapteurLiveComponent implements OnInit {
  private readonly bff = inject(BffApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /** Ouvrage (station) dont on agrège les capteurs — la clé métier, pas la commune. */
  private readonly ouvrageId = signal<string>('');
  /** Capteurs de CET ouvrage (validés), rafraîchis par polling. */
  readonly capteurs = signal<CapteurDto[]>([]);
  /** Buffer roulant du niveau (%) pour la courbe. */
  readonly serie = signal<number[]>([]);
  private lastRecu = signal<number>(Date.now());
  readonly tick = signal<number>(0);

  urd(): string { return this.auth.userSnapshot()?.dept ?? '—'; }

  ngOnInit(): void {
    this.ouvrageId.set(this.route.snapshot.paramMap.get('id') ?? '');
    interval(4000).pipe(
      startWith(0),
      switchMap(() => this.bff.listCapteurs().pipe(catchError(() => of([] as CapteurDto[])))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(rows => {
      // Agrégation par OUVRAGE (clé métier) : capteurs validés de cet ouvrage uniquement.
      const liste = (rows ?? []).filter(c => c.statut === 'VALIDEE' && c.ouvrageId === this.ouvrageId());
      const niveauAvant = this.pickFrom(this.capteurs(), 'NIVEAU')?.lastValue ?? null;
      this.capteurs.set(liste);
      const niv = this.pickFrom(liste, 'NIVEAU');
      if (niv?.lastValue != null && niv.lastValue !== niveauAvant) {
        this.lastRecu.set(Date.now());
        this.serie.update(s => [...s, niv.lastValue as number].slice(-40));
      }
    });
    interval(1000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.tick.update(t => t + 1));
  }

  // ── Sélection par type ──────────────────────────────────────────────────────
  private pickFrom(list: CapteurDto[], type: string): CapteurDto | null {
    // Le plus récemment mesuré de ce type (sinon le premier).
    const ofType = list.filter(c => c.type === type);
    if (ofType.length === 0) return null;
    return ofType.slice().sort((a, b) =>
      (b.derniereMesure ?? '').localeCompare(a.derniereMesure ?? ''))[0];
  }
  private pick(type: string): CapteurDto | null { return this.pickFrom(this.capteurs(), type); }

  val(type: string, unit: string): string {
    const c = this.pick(type);
    if (!c || c.lastValue == null) return '—';
    return `${c.lastValue.toFixed(1).replace('.', ',')} ${unit}`;
  }
  critClass(type: string): string {
    const e = this.pick(type)?.etat;
    return e === 'critique' ? 'cl-card__val--crit' : e === 'attention' ? 'cl-card__val--warn' : '';
  }

  /** Pompe dérivée : active si le capteur de débit reporte un flux significatif. */
  pompeActive(): boolean {
    const d = this.pick('DEBIT');
    return d?.lastValue != null && d.etat !== 'hors-ligne' && d.lastValue > 1;
  }

  // ── État station ────────────────────────────────────────────────────────────
  enLigne(): boolean {
    return this.capteurs().some(c => c.etat === 'en-ligne' || c.etat === 'critique' || c.etat === 'attention');
  }
  niveauCritique(): boolean { return this.pick('NIVEAU')?.etat === 'critique'; }

  private worst(): 'critique' | 'attention' | 'ok' {
    const etats = this.capteurs().map(c => c.etat);
    if (etats.includes('critique')) return 'critique';
    if (etats.includes('attention')) return 'attention';
    return 'ok';
  }
  bannerClass(): string { const w = this.worst(); return w === 'critique' ? 'cl-banner--crit' : w === 'attention' ? 'cl-banner--warn' : 'cl-banner--ok'; }
  bannerIcon(): string { return this.worst() === 'ok' ? 'ti-circle-check' : 'ti-alert-triangle'; }
  bannerText(): string {
    const w = this.worst();
    if (w === 'critique') return 'Seuil critique franchi — alerte émise (voir la cloche / page Alertes).';
    if (w === 'attention') return 'Une mesure en zone d\'attention — sous surveillance.';
    return 'Tout est normal — mesures dans les plages attendues.';
  }

  // ── En-tête ─────────────────────────────────────────────────────────────────
  stationNom(): string {
    return this.capteurs()[0]?.ouvrageNom ?? 'Station';
  }
  stationCode(): string {
    const n = this.capteurs().length;
    return `${n} capteur${n > 1 ? 's' : ''}`;
  }

  majLabel(): string {
    this.tick();
    if (this.serie().length === 0) return '—';
    const s = Math.round((Date.now() - this.lastRecu()) / 1000);
    return s <= 1 ? 'à l\'instant' : `il y a ${s} s`;
  }

  // ── Courbe (niveau %, échelle fixe 0..100) ─────────────────────────────────
  y(v: number): number { return 38 - (Math.max(0, Math.min(100, v)) / 100) * 36; }
  polyline(): string {
    const s = this.serie();
    if (s.length < 2) return '';
    const n = s.length;
    return s.map((v, i) => `${((i / (n - 1)) * 100).toFixed(1)},${this.y(v).toFixed(1)}`).join(' ');
  }
}
