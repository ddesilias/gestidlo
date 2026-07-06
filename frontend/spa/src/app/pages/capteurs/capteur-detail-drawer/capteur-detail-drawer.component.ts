import {
  ChangeDetectionStrategy, Component, EventEmitter,
  HostListener, Input, OnChanges, Output, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Capteur, CapteurStatut } from '../../../capteur.store';

export type Onglet = 'overview' | 'mesures' | 'sante' | 'maintenance' | 'config';

const GAUGE_ARC_LEN = 188.5; // π × 60

const SEUILS: Record<string, { attention: number; critique: number; max: number; normal: number }> = {
  pression: { attention: 1.5, critique: 1.0, normal: 3.5, max: 10 },
  niveau:   { attention: 25,  critique: 15,  normal: 60,  max: 100 },
  debit:    { attention: 5,   critique: 3,   normal: 18,  max: 50 },
  qualite:  { attention: 6.5, critique: 5.5, normal: 7.2, max: 14 },
};

@Component({
  selector: 'app-capteur-detail-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './capteur-detail-drawer.component.html',
  styleUrls: ['./capteur-detail-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapteurDetailDrawerComponent implements OnChanges {
  @Input({ required: true }) capteur!: Capteur;
  @Input() prevCapteur: Capteur | null = null;
  @Input() nextCapteur: Capteur | null = null;
  @Input() liste: Capteur[] = [];
  @Output() fermer      = new EventEmitter<void>();
  @Output() naviguer    = new EventEmitter<'prev' | 'next'>();
  @Output() selectionner = new EventEmitter<Capteur>();

  readonly onglet = signal<Onglet>('overview');

  readonly ONGLETS: { id: Onglet; label: string; badge?: string }[] = [
    { id: 'overview',    label: 'Vue d\'ensemble' },
    { id: 'mesures',     label: 'Mesures', badge: '24h' },
    { id: 'sante',       label: 'Santé' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'config',      label: 'Configuration' },
  ];

  // ── Sparkline (seeded) ────────────────────────────────────────────────────
  sparkPts: number[] = [];
  chart24Pts: number[] = [];

  ngOnChanges(): void {
    this.sparkPts     = this._buildSparkline(20);
    this.chart24Pts   = this._buildChart24();
    this.onglet.set('overview');
  }

  private _seed(): number {
    return this.capteur?.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) ?? 1;
  }

  private _buildSparkline(n: number): number[] {
    const base = this.capteur?.valeur ?? 2;
    const seed = this._seed();
    const rng = (i: number) => ((Math.sin(seed * 9.301 + i * 7.791) + 1) / 2);
    const pts = Array.from({ length: n }, (_, i) => {
      const noise = (rng(i) - 0.5) * base * 0.5;
      return Math.max(0, base + noise);
    });
    pts[pts.length - 1] = base;
    return pts;
  }

  private _buildChart24(): number[] {
    const s = SEUILS[this.capteur?.type] ?? SEUILS['pression'];
    const base = this.capteur?.valeur ?? s.normal;
    const isAlert = this.capteur?.statut === 'critique' || this.capteur?.statut === 'attention';
    const seed = this._seed();
    const rng = (i: number) => ((Math.sin(seed * 4.321 + i * 5.678) + 1) / 2);
    return Array.from({ length: 50 }, (_, i) => {
      const prog = i / 49;
      const startVal = isAlert ? s.normal : base;
      const val = startVal + (base - startVal) * prog;
      const noise = (rng(i) - 0.5) * Math.abs(base) * 0.25;
      return Math.max(0, val + noise);
    });
  }

  // ── 24h chart SVG ─────────────────────────────────────────────────────────
  readonly CHART_W = 420;
  readonly CHART_H = 130;

  chartY(val: number): number {
    const s = SEUILS[this.capteur?.type] ?? SEUILS['pression'];
    return this.CHART_H - (val / s.max) * (this.CHART_H - 20) - 10;
  }

  chart24Path(): string {
    const pts = this.chart24Pts;
    if (!pts.length) return '';
    const xy = (i: number) =>
      `${(i / (pts.length - 1)) * this.CHART_W},${this.chartY(pts[i])}`;
    return 'M' + pts.map((_, i) => xy(i)).join(' L');
  }

  chart24Fill(): string {
    if (!this.chart24Pts.length) return '';
    const H = this.CHART_H, W = this.CHART_W;
    return `${this.chart24Path()} L${W},${H} L0,${H} Z`;
  }

  chartAlertX(): number {
    const isAlert = this.capteur?.statut === 'critique' || this.capteur?.statut === 'attention';
    return isAlert ? Math.round(this.CHART_W * 0.6) : -100;
  }

  chart24Min(): string {
    if (!this.chart24Pts.length) return '—';
    return Math.min(...this.chart24Pts).toFixed(1);
  }
  chart24Max(): string {
    if (!this.chart24Pts.length) return '—';
    return Math.max(...this.chart24Pts).toFixed(1);
  }
  chart24Avg(): string {
    if (!this.chart24Pts.length) return '—';
    return (this.chart24Pts.reduce((a, b) => a + b, 0) / this.chart24Pts.length).toFixed(1);
  }

  tendancePct(): string {
    const s = SEUILS[this.capteur?.type] ?? SEUILS['pression'];
    const v = this.capteur?.valeur ?? s.normal;
    const pct = Math.round(((v - s.normal) / s.normal) * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  }

  tendanceUp(): boolean {
    const s = SEUILS[this.capteur?.type] ?? SEUILS['pression'];
    return (this.capteur?.valeur ?? s.normal) >= s.normal;
  }

  // ── Gauge with needle ─────────────────────────────────────────────────────
  gaugeAngleDeg(): number {
    const s = SEUILS[this.capteur?.type] ?? SEUILS['pression'];
    const pct = Math.min((this.capteur?.valeur ?? 0) / s.max, 1);
    return 180 - pct * 180;
  }

  gaugeNeedleX(): number {
    const a = this.gaugeAngleDeg() * Math.PI / 180;
    return Math.round((80 + 50 * Math.cos(a)) * 10) / 10;
  }

  gaugeNeedleY(): number {
    const a = this.gaugeAngleDeg() * Math.PI / 180;
    return Math.round((80 - 50 * Math.sin(a)) * 10) / 10;
  }

  gaugeTickEndX(val: number): number {
    const s = SEUILS[this.capteur?.type] ?? SEUILS['pression'];
    const a = (180 - (val / s.max) * 180) * Math.PI / 180;
    return Math.round((80 + 64 * Math.cos(a)) * 10) / 10;
  }

  gaugeTickEndY(val: number): number {
    const s = SEUILS[this.capteur?.type] ?? SEUILS['pression'];
    const a = (180 - (val / s.max) * 180) * Math.PI / 180;
    return Math.round((80 - 64 * Math.sin(a)) * 10) / 10;
  }

  gaugeTickLblX(val: number): number {
    const s = SEUILS[this.capteur?.type] ?? SEUILS['pression'];
    const a = (180 - (val / s.max) * 180) * Math.PI / 180;
    return Math.round((80 + 76 * Math.cos(a)) * 10) / 10;
  }

  gaugeTickLblY(val: number): number {
    const s = SEUILS[this.capteur?.type] ?? SEUILS['pression'];
    const a = (180 - (val / s.max) * 180) * Math.PI / 180;
    return Math.round((80 - 76 * Math.sin(a)) * 10) / 10;
  }

  gaugeDashArray(): string {
    const s = SEUILS[this.capteur?.type] ?? SEUILS['pression'];
    const pct = Math.min((this.capteur?.valeur ?? 0) / s.max, 1);
    return `${pct * GAUGE_ARC_LEN} ${GAUGE_ARC_LEN}`;
  }

  gaugeColor(): string {
    const st = this.capteur?.statut;
    if (st === 'critique')  return '#EF4444';
    if (st === 'attention') return '#F59E0B';
    return '#10B981';
  }

  gaugeMax(): string { return (SEUILS[this.capteur?.type]?.max ?? 10).toString(); }

  // ── Mini-list sidebar ─────────────────────────────────────────────────────
  listeVignettes(): Capteur[] {
    if (!this.liste.length) return [];
    const idx = this.liste.findIndex(c => c.id === this.capteur?.id);
    const start = Math.max(0, Math.min(idx - 2, this.liste.length - 5));
    return this.liste.slice(start, start + 5);
  }

  vignetteDotColor(c: Capteur): string {
    if (c.statut === 'critique')  return '#EF4444';
    if (c.statut === 'attention') return '#F59E0B';
    if (c.statut === 'hors-ligne') return '#6B7785';
    return '#10B981';
  }

  vignetteBorderColor(c: Capteur): string {
    if (c.statut === 'critique' || c.statut === 'attention')
      return c.id === this.capteur?.id ? '#3B82F6' : (c.statut === 'critique' ? '#EF4444' : '#F59E0B');
    if (c.statut === 'hors-ligne') return '#6B7785';
    if (c.id === this.capteur?.id) return '#3B82F6';
    return '#10B981';
  }

  vignetteBg(c: Capteur): string {
    if (c.id === this.capteur?.id) return '#161E28';
    return '#0F1419';
  }

  vignetteCode(c: Capteur): string {
    return c.code.replace('CPT-', '');
  }

  // ── Capteurs voisins ──────────────────────────────────────────────────────
  capteursVoisins(): Capteur[] {
    if (!this.liste.length) return [];
    return this.liste
      .filter(c => c.id !== this.capteur?.id
        && (c.commune === this.capteur?.commune || c.infraCode === this.capteur?.infraCode))
      .slice(0, 4);
  }

  voisinDotColor(c: Capteur): string { return this.vignetteDotColor(c); }

  voisinValeur(c: Capteur): string {
    if (c.valeur == null) return '—';
    return `${c.valeur} ${c.unite}`;
  }

  voisinCardCls(c: Capteur): string {
    if (c.statut === 'critique') return 'cdd-voisin--crit';
    if (c.statut === 'attention') return 'cdd-voisin--att';
    return 'cdd-voisin--ok';
  }

  // ── Sparkline helpers (Mesures tab) ──────────────────────────────────────
  sparkPath(): string {
    if (!this.sparkPts.length) return '';
    const W = 260, H = 56;
    const mn = Math.min(...this.sparkPts), mx = Math.max(...this.sparkPts);
    const rng = mx - mn || 1;
    const xy = (i: number) => `${(i / (this.sparkPts.length - 1)) * W},${H - ((this.sparkPts[i] - mn) / rng) * (H - 8) - 4}`;
    return 'M' + this.sparkPts.map((_, i) => xy(i)).join(' L');
  }

  sparkFill(): string {
    if (!this.sparkPts.length) return '';
    return `${this.sparkPath()} L260,56 L0,56 Z`;
  }

  sparkCurrentY(): number {
    if (!this.sparkPts.length) return 28;
    const H = 56, mn = Math.min(...this.sparkPts), mx = Math.max(...this.sparkPts);
    const last = this.sparkPts[this.sparkPts.length - 1];
    return H - ((last - mn) / (mx - mn || 1)) * (H - 8) - 4;
  }

  sparkMin(): string { return this.sparkPts.length ? Math.min(...this.sparkPts).toFixed(1) : '—'; }
  sparkMax(): string { return this.sparkPts.length ? Math.max(...this.sparkPts).toFixed(1) : '—'; }
  sparkAvg(): string {
    if (!this.sparkPts.length) return '—';
    return (this.sparkPts.reduce((a, b) => a + b, 0) / this.sparkPts.length).toFixed(1);
  }

  // ── Battery sparkline ─────────────────────────────────────────────────────
  battPts(): number[] {
    const b = this.capteur?.batterie ?? 50;
    const seed = this._seed();
    const rng = (i: number) => (Math.sin(seed * 3.14 + i * 2.71) + 1) / 2;
    return Array.from({ length: 30 }, (_, i) => {
      const decay = (30 - i) * 1.2 + b;
      return Math.max(5, Math.min(100, decay + (rng(i) - 0.5) * 5));
    });
  }

  battPath(): string {
    const pts = this.battPts();
    const W = 260, H = 48;
    const mn = Math.min(...pts);
    const rng = 100 - mn || 1;
    const xy = (i: number) =>
      `${(i / (pts.length - 1)) * W},${H - ((pts[i] - mn) / rng) * (H - 4) - 2}`;
    return 'M' + pts.map((_, i) => xy(i)).join(' L');
  }

  battFill(): string {
    const pts = this.battPts();
    if (!pts.length) return '';
    return `${this.battPath()} L260,48 L0,48 Z`;
  }

  battColor(): string {
    const b = this.capteur?.batterie ?? 100;
    if (b <= 20) return '#EF4444';
    if (b <= 50) return '#F59E0B';
    return '#10B981';
  }

  // ── Display helpers ───────────────────────────────────────────────────────
  typeLabel(): string {
    return { pression: 'Pression', debit: 'Débit', niveau: 'Niveau', qualite: 'Qualité' }[this.capteur?.type] ?? '';
  }

  statutLabel(s: CapteurStatut): string {
    return ({
      'en-ligne': 'En ligne', 'hors-ligne': 'Hors ligne', 'critique': 'CRITIQUE',
      'attention': 'ATTENTION', 'maintenance': 'Maintenance',
      'signal-faible': 'Signal faible', 'batterie-faible': 'Batterie faible',
    } as Record<string, string>)[s] ?? s;
  }

  statutCls(s: CapteurStatut): string {
    return ({
      'en-ligne': 'cdd-badge--online', 'hors-ligne': 'cdd-badge--offline',
      'critique': 'cdd-badge--critique', 'attention': 'cdd-badge--attention',
      'maintenance': 'cdd-badge--maintenance', 'signal-faible': 'cdd-badge--signal',
      'batterie-faible': 'cdd-badge--battery',
    } as Record<string, string>)[s] ?? '';
  }

  signalLabel(bars: number): string {
    if (bars === 0) return 'Aucun signal';
    if (bars === 1) return 'Très faible';
    if (bars === 2) return 'Faible';
    if (bars === 3) return 'Moyen';
    return 'Excellent';
  }

  signalDotCls(bars: number): string {
    if (bars >= 4) return 'cdd-signal--ok';
    if (bars >= 2) return 'cdd-signal--warn';
    return 'cdd-signal--bad';
  }

  battCls(b?: number): string {
    if (b == null) return 'cdd-batt--none';
    if (b <= 20)   return 'cdd-batt--low';
    if (b <= 50)   return 'cdd-batt--mid';
    return 'cdd-batt--ok';
  }

  mqttTopic(): string {
    const c = this.capteur;
    if (!c) return '';
    const slug = (s: string) => s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-');
    return `gestidlo/${slug(c.commune)}/${slug(c.section ?? 'centre')}/${c.infraCode.toLowerCase()}/${c.type}`;
  }

  modele(): string {
    return ({
      pression: 'Danfoss MBS 3000',
      debit:    'YF-S201 · Hall Effect',
      niveau:   'JSN-SR04T · ultrasonique',
      qualite:  'Atlas Scientific pH',
    } as Record<string, string>)[this.capteur?.type] ?? '—';
  }

  numSerie(): string {
    const seed = this.capteur?.id ?? 'c000';
    return `SN-2026-${seed.replace('c', 'A').toUpperCase()}`;
  }

  seuils(): { attention: number; critique: number; normal: number; max: number } {
    return SEUILS[this.capteur?.type] ?? SEUILS['pression'];
  }

  dateInstallation(): string {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const seed = this.capteur?.id.charCodeAt(1) ?? 1;
    return `${10 + (seed % 20)} ${months[seed % 12]} 2026`;
  }

  needsMaintenance(): boolean {
    return this.capteur?.statut === 'critique' || this.capteur?.statut === 'attention'
      || this.capteur?.statut === 'hors-ligne';
  }

  successRate(): string {
    const b = this.capteur?.signalBars ?? 4;
    if (b >= 4) return '99.2'; if (b >= 3) return '97.1'; if (b >= 2) return '89.4'; return '72.3';
  }

  latency(): string {
    const b = this.capteur?.signalBars ?? 4;
    if (b >= 4) return '23'; if (b >= 3) return '48'; if (b >= 2) return '124'; return '—';
  }

  signalDbm(): string {
    const b = this.capteur?.signalBars ?? 4;
    if (b >= 4) return '-65'; if (b >= 3) return '-72'; if (b >= 2) return '-81'; return '—';
  }

  signalBars(): number[] {
    return Array.from({ length: 5 }, (_, i) => i);
  }

  @HostListener('keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') this.fermer.emit();
    if (e.key === 'ArrowLeft'  && e.altKey) this.naviguer.emit('prev');
    if (e.key === 'ArrowRight' && e.altKey) this.naviguer.emit('next');
  }
}
