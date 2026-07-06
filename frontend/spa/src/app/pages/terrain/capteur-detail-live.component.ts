import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { interval, startWith, switchMap, catchError, of } from 'rxjs';

import { AuthService } from '../../auth.service';
import { BffApiService, CapteurDto } from '../../api/bff-api.service';

/**
 * Page « live » d'UN capteur précis (vue technicien) — détail d'une seule métrique, par
 * opposition à {@link CapteurLiveComponent} qui agrège la STATION (l'ouvrage).
 *
 * Aucune nouvelle API : on poll le même endpoint scopé `/api/iot/capteurs` (le JWT tranche le
 * périmètre) et on isole le capteur par son code. La courbe et l'historique sont accumulés
 * CÔTÉ CLIENT à chaque trame — il n'existe pas de stockage d'historique serveur (même pattern
 * que la station). Sécurité cross-commune gratuite : un capteur hors périmètre n'apparaît jamais
 * dans la réponse scopée → on affiche « introuvable / hors périmètre ».
 */
@Component({
  selector: 'app-capteur-detail-live',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
<div class="cd">
  <a class="cd-bc" [routerLink]="['../..']"><i class="ti ti-chevron-left"></i> Retour aux capteurs</a>

  <ng-container *ngIf="capteur() as c; else absent">
    <!-- En-tête -->
    <header class="cd-head">
      <div>
        <div class="cd-title">{{ c.nom }}</div>
        <div class="cd-sub">
          <i class="ti ti-building-factory-2"></i>
          <a *ngIf="c.ouvrageId" class="cd-link" [routerLink]="['../..','ouvrage', c.ouvrageId]">{{ c.ouvrageNom || 'Ouvrage' }}</a>
          <span *ngIf="!c.ouvrageId">{{ c.ouvrageNom || 'Sans ouvrage' }}</span>
          · {{ c.commune || '—' }} · URD {{ urd() }}
        </div>
      </div>
      <div class="cd-head-r">
        <span class="cd-online" [class.cd-online--off]="!enLigne(c)">
          <span class="cd-dot" [class.cd-dot--off]="!enLigne(c)"></span>{{ enLigne(c) ? 'En ligne' : 'Hors ligne' }}
        </span>
        <div class="cd-maj">{{ c.derniereMesure ? ago(c.derniereMesure) : 'jamais transmis' }}</div>
      </div>
    </header>

    <!-- Bannière état -->
    <div class="cd-banner" [ngClass]="bannerClass(c)">
      <i class="ti" [ngClass]="bannerIcon(c)"></i><span>{{ bannerText(c) }}</span>
    </div>

    <!-- Cartes -->
    <div class="cd-grid">
      <div class="cd-card">
        <div class="cd-card__lbl"><i class="ti ti-gauge"></i> Dernière valeur</div>
        <div class="cd-card__val" [ngClass]="critClass(c)">{{ valeur(c) }}</div>
        <div class="cd-card__sub">{{ seuilRef(c.type) }}</div>
      </div>
      <div class="cd-card">
        <div class="cd-card__lbl"><i class="ti ti-category"></i> Type de capteur</div>
        <div class="cd-card__val">{{ typeLabel(c.type) }}</div>
        <div class="cd-card__sub">unité {{ c.unit || '—' }}</div>
      </div>
      <div class="cd-card">
        <div class="cd-card__lbl"><i class="ti ti-battery-3"></i> Batterie</div>
        <div class="cd-card__val">{{ c.battery != null ? c.battery + ' %' : '—' }}</div>
        <div class="cd-card__sub">{{ c.battery != null ? batterieLabel(c.battery) : 'non transmise' }}</div>
      </div>
      <div class="cd-card">
        <div class="cd-card__lbl"><i class="ti ti-antenna"></i> Signal</div>
        <div class="cd-card__val">{{ c.signal != null ? signalLabel(c.signal) : '—' }}</div>
        <div class="cd-card__sub">{{ c.signal != null ? c.signal + ' dBm' : 'non transmis' }}</div>
      </div>
    </div>

    <!-- Courbe temps réel (buffer roulant, auto-échelle) -->
    <div class="cd-chart-head">
      <span>Courbe temps réel · {{ typeLabel(c.type) }}</span>
      <span class="cd-live"><span class="cd-dot"></span>flux temps réel</span>
    </div>
    <div class="cd-chart">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" class="cd-svg">
        <polyline *ngIf="serie().length > 1" [attr.points]="polyline()" fill="none"
                  [attr.stroke]="critique(c) ? '#f87171' : '#378add'" stroke-width="1.4" vector-effect="non-scaling-stroke" />
      </svg>
      <div *ngIf="serie().length < 2" class="cd-wait">En attente de mesures — les prochaines trames rempliront la courbe.</div>
    </div>

    <!-- Historique récent -->
    <div class="cd-sec">Historique récent</div>
    <div class="cd-histo" *ngIf="histo().length; else noHisto">
      <div class="cd-histo__row" *ngFor="let h of histo()">
        <span class="cd-histo__t">{{ h.t }}</span>
        <span class="cd-histo__v">{{ h.v }} {{ c.unit }}</span>
      </div>
    </div>
    <ng-template #noHisto><div class="cd-muted">Aucune mesure reçue depuis l'ouverture de la page.</div></ng-template>

    <!-- Infos techniques -->
    <div class="cd-sec">Informations techniques</div>
    <table class="cd-tech">
      <tr><td>Code</td><td class="cd-mono">{{ c.code }}</td></tr>
      <tr><td>Device</td><td class="cd-mono">{{ c.deviceId || '—' }}</td></tr>
      <tr><td>Topic MQTT</td><td class="cd-mono">{{ c.mqttTopic || '—' }}</td></tr>
      <tr><td>Ouvrage</td><td>{{ c.ouvrageNom || '—' }}</td></tr>
      <tr><td>Validation</td><td>{{ c.statut }}</td></tr>
    </table>

    <div class="cd-foot">
      <i class="ti ti-lock"></i> Données reçues du capteur (HTTP) · périmètre filtré selon votre rôle (JWT).
    </div>
  </ng-container>

  <ng-template #absent>
    <div class="cd-absent" *ngIf="!loading()">
      <i class="ti ti-alert-triangle"></i>
      <div>Capteur introuvable dans votre périmètre — il n'existe pas ou n'appartient pas à votre territoire.</div>
    </div>
    <div class="cd-absent" *ngIf="loading()">Chargement…</div>
  </ng-template>
</div>
  `,
  styles: [`
    .cd { color:#e6edf3; max-width:760px; }
    .cd-bc { display:inline-flex; align-items:center; gap:4px; font-size:12px; color:#8b949e; text-decoration:none; margin-bottom:10px; }
    .cd-bc:hover { color:#c9d1d9; } .cd-bc i { font-size:14px; }
    .cd-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding-bottom:12px; border-bottom:1px solid rgba(255,255,255,.08); }
    .cd-title { font-size:17px; font-weight:500; }
    .cd-sub { font-size:13px; color:#8b949e; margin-top:3px; } .cd-sub i { font-size:14px; vertical-align:-2px; margin-right:3px; }
    .cd-link { color:#58a6ff; text-decoration:none; } .cd-link:hover { text-decoration:underline; }
    .cd-head-r { text-align:right; white-space:nowrap; }
    .cd-online { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:#3fb950; background:rgba(63,185,80,.12); padding:4px 10px; border-radius:999px; }
    .cd-online--off { color:#8b949e; background:rgba(255,255,255,.06); }
    .cd-dot { width:8px; height:8px; border-radius:50%; background:#3fb950; display:inline-block; animation:cdpulse 1.4s infinite; }
    .cd-dot--off { background:#8b949e; animation:none; }
    @keyframes cdpulse { 0%,100%{opacity:1} 50%{opacity:.3} }
    .cd-maj { font-size:12px; color:#6e7681; margin-top:5px; }
    .cd-banner { display:flex; align-items:center; gap:9px; margin-top:14px; padding:11px 13px; border-radius:9px; font-size:13px; }
    .cd-banner i { font-size:18px; }
    .cd-banner--ok { background:rgba(63,185,80,.1); color:#3fb950; }
    .cd-banner--warn { background:rgba(245,158,11,.12); color:#fbbf24; }
    .cd-banner--crit { background:rgba(248,113,113,.12); color:#f87171; }
    .cd-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:14px; }
    .cd-card { background:#161b22; border-radius:9px; padding:12px 14px; }
    .cd-card__lbl { display:flex; align-items:center; gap:6px; font-size:13px; color:#8b949e; } .cd-card__lbl i { font-size:16px; }
    .cd-card__val { font-size:24px; font-weight:500; margin-top:4px; }
    .cd-card__val--crit { color:#f87171; } .cd-card__val--warn { color:#fbbf24; }
    .cd-card__sub { font-size:12px; color:#6e7681; margin-top:2px; }
    .cd-chart-head { display:flex; align-items:center; justify-content:space-between; margin-top:18px; font-size:14px; font-weight:500; }
    .cd-live { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:#8b949e; font-weight:400; }
    .cd-chart { position:relative; height:165px; margin-top:6px; background:#0d1117; border:1px solid rgba(255,255,255,.06); border-radius:9px; padding:8px; }
    .cd-svg { width:100%; height:100%; display:block; }
    .cd-wait { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; text-align:center; padding:0 20px; font-size:12px; color:#6e7681; }
    .cd-sec { margin-top:18px; font-size:14px; font-weight:500; }
    .cd-histo { margin-top:8px; background:#0d1117; border:1px solid rgba(255,255,255,.06); border-radius:9px; overflow:hidden; }
    .cd-histo__row { display:flex; justify-content:space-between; padding:8px 12px; font-size:13px; border-top:1px solid rgba(255,255,255,.05); }
    .cd-histo__row:first-child { border-top:0; }
    .cd-histo__t { color:#8b949e; font-variant-numeric:tabular-nums; }
    .cd-histo__v { font-weight:500; font-variant-numeric:tabular-nums; }
    .cd-muted { font-size:12.5px; color:#6e7681; margin-top:8px; }
    .cd-tech { width:100%; margin-top:8px; font-size:13px; border-collapse:collapse; }
    .cd-tech td { padding:6px 0; border-top:1px solid rgba(255,255,255,.05); }
    .cd-tech tr:first-child td { border-top:0; }
    .cd-tech td:first-child { color:#8b949e; width:34%; }
    .cd-mono { font-family:ui-monospace,Menlo,monospace; font-size:12px; }
    .cd-foot { font-size:12px; color:#6e7681; margin-top:16px; padding-top:10px; border-top:1px solid rgba(255,255,255,.06); } .cd-foot i { font-size:13px; vertical-align:-2px; margin-right:4px; }
    .cd-absent { display:flex; align-items:center; gap:10px; margin-top:30px; padding:16px; background:#161b22; border-radius:9px; font-size:13.5px; color:#8b949e; } .cd-absent i { font-size:20px; color:#fbbf24; }
  `],
})
export class CapteurDetailLiveComponent implements OnInit {
  private readonly bff = inject(BffApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly capteurId = signal<string>('');
  readonly capteur = signal<CapteurDto | null>(null);
  readonly loading = signal(true);
  /** Buffer roulant des valeurs (sparkline auto-échelle) et historique horodaté (client-side). */
  readonly serie = signal<number[]>([]);
  readonly histo = signal<{ t: string; v: string }[]>([]);

  urd(): string { return this.auth.userSnapshot()?.dept ?? '—'; }

  ngOnInit(): void {
    this.capteurId.set(this.route.snapshot.paramMap.get('capteurId') ?? '');
    interval(4000).pipe(
      startWith(0),
      switchMap(() => this.bff.listCapteurs().pipe(catchError(() => of([] as CapteurDto[])))),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(rows => {
      const id = this.capteurId().toLowerCase();
      const c = (rows ?? []).find(x => x.code.toLowerCase() === id || x.id.toLowerCase() === id) ?? null;
      const avant = this.capteur()?.lastValue ?? null;
      this.capteur.set(c);
      this.loading.set(false);
      if (c?.lastValue != null && c.lastValue !== avant) {
        this.serie.update(s => [...s, c.lastValue as number].slice(-40));
        this.histo.update(h => [{ t: this.hhmmss(), v: this.fmt(c.lastValue as number) }, ...h].slice(0, 8));
      }
    });
  }

  // ── Affichage ───────────────────────────────────────────────────────────────
  enLigne(c: CapteurDto): boolean { return c.etat !== 'hors-ligne'; }
  critique(c: CapteurDto): boolean { return c.etat === 'critique' || c.etat === 'seuil'; }
  valeur(c: CapteurDto): string {
    if (c.lastValue == null) return '—';
    return `${this.fmt(c.lastValue)} ${c.unit ?? ''}`.trim();
  }
  critClass(c: CapteurDto): string {
    return this.critique(c) ? 'cd-card__val--crit' : c.etat === 'attention' ? 'cd-card__val--warn' : '';
  }
  typeLabel(t: string): string {
    return { PRESSION: 'Pression', NIVEAU: 'Niveau', DEBIT: 'Débit', QUALITE: 'Qualité' }[t] ?? t;
  }
  /** Seuil de RÉFÉRENCE (DINEPA / nominal), aligné sur la station — non stocké par capteur. */
  seuilRef(t: string): string {
    return {
      NIVEAU:   'seuil critique 30 %',
      DEBIT:    'plage 5–30 L/min',
      PRESSION: 'nominal 1,8–2,5 bar',
      QUALITE:  'selon paramètre',
    }[t] ?? 'référence —';
  }
  batterieLabel(b: number): string { return b >= 60 ? 'bon niveau' : b >= 25 ? 'à surveiller' : 'faible'; }
  signalLabel(dbm: number): string { return dbm >= -65 ? 'Bon' : dbm >= -80 ? 'Moyen' : 'Faible'; }

  bannerClass(c: CapteurDto): string {
    return this.critique(c) ? 'cd-banner--crit' : c.etat === 'attention' ? 'cd-banner--warn' : 'cd-banner--ok';
  }
  bannerIcon(c: CapteurDto): string { return this.critique(c) || c.etat === 'attention' ? 'ti-alert-triangle' : 'ti-circle-check'; }
  bannerText(c: CapteurDto): string {
    if (this.critique(c)) return 'Seuil franchi — alerte émise (voir la cloche / page Alertes).';
    if (c.etat === 'attention') return 'Mesure en zone d\'attention — sous surveillance.';
    if (!this.enLigne(c)) return 'Capteur hors ligne — dernière valeur connue affichée.';
    return 'Tout est normal — valeur dans les plages attendues.';
  }

  ago(iso: string): string {
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `il y a ${s} s`;
    if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
    return `il y a ${Math.round(s / 3600)} h`;
  }

  // ── Courbe (auto-échelle sur min/max du buffer) ─────────────────────────────
  private bounds(): { min: number; max: number } {
    const s = this.serie();
    let min = Math.min(...s), max = Math.max(...s);
    if (!isFinite(min) || !isFinite(max)) return { min: 0, max: 1 };
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.1;
    return { min: min - pad, max: max + pad };
  }
  private y(v: number): number {
    const { min, max } = this.bounds();
    return 38 - ((v - min) / (max - min)) * 36;
  }
  polyline(): string {
    const s = this.serie();
    if (s.length < 2) return '';
    const n = s.length;
    return s.map((v, i) => `${((i / (n - 1)) * 100).toFixed(1)},${this.y(v).toFixed(1)}`).join(' ');
  }

  private fmt(v: number): string { return v.toFixed(1).replace('.', ','); }
  private hhmmss(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
}
