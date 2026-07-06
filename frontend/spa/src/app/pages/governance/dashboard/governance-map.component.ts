import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';

import { TerritoriesService, GeoJsonGeometry } from '../../../territories.service';
import { DeptSante } from './governance-signals.service';

interface DeptPath { name: string; d: string; cx: number; cy: number; }

const NON_DEPLOYE = '#3b455c';

/** Normalise 'Sud-Est' / "Grand'Anse" → 'sudest' / 'grandanse'. */
function key(nom: string): string {
  return (nom || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['\s-]/g, '');
}

/**
 * Zone B · carte départementale — le HÉROS (§4.1). Choroplèthe SVG des 10 départements d'Haïti,
 * VRAIE géométrie administrative (GeoJSON OSM/geoBoundaries via `/geo/territories.geojson`),
 * projetée en équirectangulaire CORRIGÉE en latitude (pas de déformation). Data-map épurée : on ne
 * peint que les polygones sur le fond sombre — pas de tuiles OSM. Coloré par l'indice de santé
 * (même source que le classement). Survol = tooltip, clic = drill-down.
 */
@Component({
  selector: 'app-governance-map',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gmap">
      <div class="gmap__head">
        <span class="gmap__title">État du réseau · par département</span>
        <span class="gmap__hint">cliquez un département déployé → URD</span>
      </div>

      <svg class="gmap__svg" [attr.viewBox]="geo().vb" role="img"
           aria-label="Carte des départements d'Haïti colorés par état de santé du réseau">
        <path *ngFor="let p of geo().paths" [attr.d]="p.d"
          class="dept" [class.dept--dep]="actif(p.name)" [class.dept--sel]="estSelection(p.name)"
          [attr.data-crit]="isCrit(p.name)"
          [attr.fill]="fill(p.name)" [attr.fill-opacity]="actif(p.name) ? 0.85 : 0.45"
          (click)="clic(p.name)">
          <title>{{ tooltip(p.name) }}</title>
        </path>
        <text *ngFor="let p of geo().paths" class="lbl" [attr.x]="p.cx" [attr.y]="p.cy"
          [style.opacity]="actif(p.name) ? 1 : 0.5"
          [style.font-weight]="actif(p.name) ? 600 : 400">{{ p.name }}</text>
      </svg>

      <div class="gmap__legend">
        <span><i class="dot" style="background:var(--text-danger)"></i> Critique</span>
        <span><i class="dot" style="background:var(--text-warning)"></i> Attention</span>
        <span><i class="dot" style="background:var(--text-success)"></i> Bon</span>
        <span><i class="dot" [style.background]="ND"></i> Non déployé</span>
        <span class="gmap__note">géométrie OSM · prod : PostGIS</span>
      </div>
    </div>
  `,
  styles: [`
    .gmap { background:var(--surface-1); border-radius:12px; padding:12px; height:100%; display:flex; flex-direction:column; }
    .gmap__head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px; }
    .gmap__title { font-size:13px; font-weight:600; color:var(--text-primary); }
    .gmap__hint { font-size:10px; color:var(--text-muted); }
    .gmap__svg { width:100%; height:auto; flex:1; min-height:260px; display:block; overflow:visible; }
    .dept { stroke:#2c3650; stroke-width:.8; transition:fill-opacity .18s, filter .18s; }
    .dept--dep { stroke:rgba(255,255,255,.35); cursor:pointer; }
    .dept--dep:hover { fill-opacity:1 !important; filter:drop-shadow(0 0 7px currentColor); }
    .dept--sel { stroke:#fff; stroke-width:2.2; fill-opacity:1 !important; filter:drop-shadow(0 0 8px rgba(255,255,255,.55)); }
    .dept[data-crit="true"] { animation:govpulse 2.6s ease-in-out infinite; }
    @keyframes govpulse { 0%,100%{ fill-opacity:.7 } 50%{ fill-opacity:1 } }
    .lbl { fill:var(--text-primary); font-size:11px; text-anchor:middle; pointer-events:none;
      paint-order:stroke; stroke:rgba(0,0,0,.45); stroke-width:2.2px; }
    .gmap__legend { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-top:8px; font-size:10px; color:var(--text-secondary); }
    .gmap__legend .dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:3px; }
    .gmap__note { margin-left:auto; color:var(--text-muted); }
  `],
})
export class GovernanceMapComponent {
  private readonly territories = inject(TerritoriesService);
  private readonly geojson = toSignal(this.territories.ensureLoaded(), { initialValue: null });

  /** Santé par département (source unique, partagée avec le classement). */
  @Input() sante: DeptSante[] = [];
  /** Département scopé — surligné (contour blanc), SANS zoomer : la carte reste nationale. */
  @Input() selected: string | null = null;
  @Output() select = new EventEmitter<string>();

  readonly ND = NON_DEPLOYE;

  /** Géométrie projetée (dépend seulement du GeoJSON — stable ; la couleur, elle, suit `sante`). */
  readonly geo = computed<{ vb: string; paths: DeptPath[] }>(() => {
    const fc = this.geojson();
    if (!fc?.features?.length) return { vb: '0 0 800 600', paths: [] };

    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    const scan = (g: GeoJsonGeometry | null) => this.rings(g).forEach(r => r.forEach(([lon, lat]) => {
      minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    }));
    fc.features.forEach(f => scan(f.geometry));

    const PAD = 14, H = 600;
    const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180); // correction longitude
    const s = (H - 2 * PAD) / (maxLat - minLat);
    const W = (maxLon - minLon) * kx * s + 2 * PAD;
    const px = (lon: number) => PAD + (lon - minLon) * kx * s;
    const py = (lat: number) => PAD + (maxLat - lat) * s;

    const paths = fc.features.map(f => {
      const rings = this.rings(f.geometry);
      const d = rings.map(r => r.map(([lo, la], i) => `${i ? 'L' : 'M'}${px(lo).toFixed(1)} ${py(la).toFixed(1)}`).join(' ') + 'Z').join(' ');
      // Centroïde de l'anneau le plus grand (placement du libellé).
      const big = rings.reduce((a, b) => (b.length > a.length ? b : a), rings[0] ?? []);
      const n = Math.max(1, big.length);
      const cx = big.reduce((s2, p) => s2 + px(p[0]), 0) / n;
      const cy = big.reduce((s2, p) => s2 + py(p[1]), 0) / n;
      return { name: String(f.properties?.['name'] ?? ''), d, cx, cy };
    });
    return { vb: `0 0 ${W.toFixed(1)} ${H}`, paths };
  });

  private rings(g: GeoJsonGeometry | null): number[][][] {
    if (!g) return [];
    if (g.type === 'Polygon') return g.coordinates as number[][][];
    if (g.type === 'MultiPolygon') return (g.coordinates as number[][][][]).flat();
    return [];
  }

  private find(name: string): DeptSante | undefined {
    return this.sante.find(d => key(d.nom) === key(name));
  }
  actif(name: string): boolean { return !!this.find(name)?.actif; }
  estSelection(name: string): boolean { return !!this.selected && key(this.selected) === key(name); }
  isCrit(name: string): boolean { const d = this.find(name); return !!d?.actif && d.statut === 'critique'; }
  fill(name: string): string {
    const d = this.find(name);
    if (!d?.actif) return NON_DEPLOYE;
    return d.statut === 'critique' ? 'var(--text-danger)' : d.statut === 'attention' ? 'var(--text-warning)' : 'var(--text-success)';
  }
  tooltip(name: string): string {
    const d = this.find(name);
    if (!d?.actif) return `${name} · non déployé`;
    return `${name} · couverture ${d.couverture}% · ${d.alertes} alerte(s)`;
  }
  clic(name: string): void { if (this.actif(name)) this.select.emit(name); }
}
