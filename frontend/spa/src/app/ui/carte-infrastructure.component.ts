import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, effect, ElementRef, inject, NgZone, OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { InfrastructureStateService } from '../infrastructure-state.service';
import { Infrastructure } from '../infrastructure.store';
import {
  HAITI_CENTER, HAITI_ZOOM, HYDRO_TILE_URL, HYDRO_TILE_OPTS,
  STATUS_COLORS,
} from '../map.config';

declare const L: any;

@Component({
  selector: 'app-carte-infrastructure',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display:block; position:relative; width:100%; height:100%; }

    .ci-shell {
      position:relative; width:100%; height:100%;
      border-radius:12px; overflow:hidden;
      background:#0d1b2a;
    }

    .ci-canvas { width:100%; height:100%; }

    .ci-fallback {
      position:absolute; inset:0;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:.6rem; color:rgba(255,255,255,.3); font-size:.8rem;
      background:#080B14;
    }

    /* Toolbar */
    .ci-toolbar {
      position:absolute; top:.7rem; left:.7rem; z-index:500;
      display:flex; flex-direction:column; gap:.3rem;
    }
    .ci-btn {
      width:32px; height:32px; border-radius:8px;
      border:.5px solid rgba(255,255,255,.15);
      background:rgba(11,18,32,.92); backdrop-filter:blur(4px);
      cursor:pointer; display:flex; align-items:center; justify-content:center;
      color:rgba(255,255,255,.6); box-shadow:0 2px 8px rgba(0,0,0,.3);
      transition:background .15s,color .15s;
    }
    .ci-btn:hover { background:rgba(96,165,250,.15); color:#60A5FA; }

    /* KPI chips on map */
    .ci-kpis {
      position:absolute; top:.7rem; right:.7rem; z-index:500;
      display:flex; gap:.4rem;
    }
    .ci-kpi {
      padding:4px 10px;
      background:rgba(11,18,32,.88); backdrop-filter:blur(4px);
      border:.5px solid rgba(255,255,255,.12); border-radius:7px;
      font-size:.68rem; font-weight:600; color:rgba(255,255,255,.7);
      display:flex; align-items:center; gap:5px;
    }
    .ci-kpi-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }

    /* Legend */
    .ci-legend {
      position:absolute; bottom:.7rem; right:.7rem; z-index:500;
      background:rgba(11,18,32,.9); backdrop-filter:blur(4px);
      border:.5px solid rgba(255,255,255,.1); border-radius:10px;
      padding:.7rem .9rem; font-size:.7rem; color:rgba(255,255,255,.75);
      min-width:160px;
    }
    .ci-legend-title {
      font-size:.6rem; font-weight:600; letter-spacing:.1em;
      text-transform:uppercase; color:rgba(255,255,255,.35); margin-bottom:.5rem;
    }
    .ci-legend-row {
      display:flex; align-items:center; gap:.4rem; margin-bottom:.2rem;
    }
    .ci-legend-dot {
      width:9px; height:9px; border-radius:50%; flex-shrink:0;
      border:1.5px solid rgba(255,255,255,.5);
    }
    .ci-legend-line {
      width:16px; height:2px; flex-shrink:0;
      background:#2563eb; border-radius:1px;
      background-image:repeating-linear-gradient(90deg,#2563eb 0,#2563eb 5px,transparent 5px,transparent 9px);
    }

    /* Selection info bar */
    .ci-selection {
      position:absolute; bottom:.7rem; left:.7rem; right:180px; z-index:500;
      background:rgba(11,18,32,.92); backdrop-filter:blur(4px);
      border:.5px solid rgba(96,165,250,.25); border-radius:10px;
      padding:.6rem 1rem; display:flex; align-items:center; gap:.75rem;
    }
    .ci-sel-code {
      font-family:'Courier New',monospace; font-size:.8rem;
      font-weight:700; color:#60A5FA; flex-shrink:0;
    }
    .ci-sel-name { flex:1; font-size:.78rem; color:#fff; font-weight:500; }
    .ci-sel-status {
      font-size:.67rem; font-weight:600; padding:2px 8px;
      border-radius:999px; flex-shrink:0;
    }
    .ci-sel-close {
      width:22px; height:22px; border:0; background:rgba(255,255,255,.07);
      border-radius:5px; cursor:pointer; color:rgba(255,255,255,.45);
      display:flex; align-items:center; justify-content:center; flex-shrink:0;
      transition:background .1s,color .1s;
    }
    .ci-sel-close:hover { background:rgba(239,68,68,.12); color:#F87171; }
  `],
  template: `
<div class="ci-shell">
  <div #mapEl class="ci-canvas" aria-label="Carte des infrastructures hydrauliques"></div>

  <!-- Fallback -->
  <div class="ci-fallback" *ngIf="!leafletOk">
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
    <span>Carte indisponible — Leaflet non chargé</span>
  </div>

  <!-- Toolbar -->
  <div class="ci-toolbar" *ngIf="leafletOk">
    <button type="button" class="ci-btn" title="Recentrer sur les ouvrages" (click)="recentrer()">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
      </svg>
    </button>
    <button type="button" class="ci-btn" title="Afficher la légende"
      (click)="legendeVisible = !legendeVisible">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/><circle cx="17.5" cy="17.5" r="3.5"/>
      </svg>
    </button>
  </div>

  <!-- KPIs en overlay -->
  <div class="ci-kpis" *ngIf="leafletOk">
    <div class="ci-kpi">
      <span class="ci-kpi-dot" style="background:#34D399"></span>
      {{ state.kpis().enService }} en service
    </div>
    <div class="ci-kpi" *ngIf="state.kpis().horsService > 0"
      style="border-color:rgba(248,113,113,.3)">
      <span class="ci-kpi-dot" style="background:#F87171"></span>
      {{ state.kpis().horsService }} critique/HS
    </div>
    <div class="ci-kpi" *ngIf="state.kpis().aInspecter > 0"
      style="border-color:rgba(249,115,22,.3)">
      <span class="ci-kpi-dot" style="background:#FB923C"></span>
      {{ state.kpis().aInspecter }} à inspecter
    </div>
  </div>

  <!-- Légende -->
  <div class="ci-legend" *ngIf="leafletOk && legendeVisible">
    <div class="ci-legend-title">Statut des ouvrages</div>
    <div class="ci-legend-row" *ngFor="let l of legendeStatuts">
      <span class="ci-legend-dot" [style.background]="l.color"></span>
      <span>{{ l.label }}</span>
    </div>
    <div class="ci-legend-row" style="margin-top:.4rem">
      <span class="ci-legend-line"></span>
      <span>Liaison AEP</span>
    </div>
  </div>

  <!-- Sélection info bar -->
  <div class="ci-selection" *ngIf="leafletOk && state.selection()">
    <span class="ci-sel-code">{{ state.selection()!.code }}</span>
    <span class="ci-sel-name">{{ state.selection()!.name }}</span>
    <span class="ci-sel-status"
      [style.background]="statusBg(state.selection()!.status)"
      [style.color]="statusColor(state.selection()!.status)">
      {{ statusLabel(state.selection()!.status) }}
    </span>
    <button type="button" class="ci-sel-close" (click)="state.selectionner(null)">
      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
    </button>
  </div>

</div>
  `,
})
export class CarteInfrastructureComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) private mapEl!: ElementRef<HTMLDivElement>;

  readonly state = inject(InfrastructureStateService);
  private readonly ngZone = inject(NgZone);
  private readonly cdr    = inject(ChangeDetectorRef);

  leafletOk    = false;
  legendeVisible = true;

  private map?: any;
  private marqueursCouche?: any;
  private liaisonsCouche?: any;
  private initialized = false;

  readonly legendeStatuts = [
    { color: STATUS_COLORS['en-service'],   label: 'En service' },
    { color: STATUS_COLORS['a-inspecter'],  label: 'À inspecter' },
    { color: STATUS_COLORS['maintenance'],  label: 'Maintenance' },
    { color: STATUS_COLORS['hors-service'], label: 'Hors service' },
    { color: STATUS_COLORS['critique'],     label: 'Critique' },
  ];

  constructor() {
    // Inject pulse CSS once into document head
    if (typeof document !== 'undefined' && !document.getElementById('ci-keyframes')) {
      const style = document.createElement('style');
      style.id = 'ci-keyframes';
      style.textContent =
        '@keyframes ci-pulse{0%,100%{transform:scale(1);opacity:.3}50%{transform:scale(2.2);opacity:0}}';
      document.head.appendChild(style);
    }

    // React to every state change — re-renders happen inside NgZone.runOutsideAngular
    effect(() => {
      const infras   = this.state.infrasFiltrees();
      const selected = this.state.selection();
      const couches  = this.state.couchesActives();

      if (!this.initialized) return;

      this.ngZone.runOutsideAngular(() => {
        if (couches.includes('marqueurs')) {
          this.renderMarqueurs(infras, selected);
        } else {
          this.marqueursCouche?.clearLayers();
        }
        if (couches.includes('liaisons')) {
          this.renderLiaisons(infras);
        } else {
          this.liaisonsCouche?.clearLayers();
        }
      });

      this.cdr.markForCheck();
    });
  }

  ngAfterViewInit(): void {
    if (typeof L === 'undefined') return;

    this.leafletOk = true;
    this.cdr.markForCheck();

    this.ngZone.runOutsideAngular(() => {
      this.map = L.map(this.mapEl.nativeElement, {
        center: HAITI_CENTER,
        zoom:   HAITI_ZOOM,
        zoomControl:       false,
        attributionControl: false,
      });

      L.control.zoom({ position: 'topright' }).addTo(this.map);
      L.tileLayer(HYDRO_TILE_URL, HYDRO_TILE_OPTS).addTo(this.map);

      this.liaisonsCouche  = L.layerGroup().addTo(this.map);
      this.marqueursCouche = L.layerGroup().addTo(this.map);

      const infras   = this.state.infrasFiltrees();
      const selected = this.state.selection();

      this.renderMarqueurs(infras, selected);
      this.renderLiaisons(infras);
      this.fitBounds(infras);

      this.initialized = true;
    });
  }

  ngOnDestroy(): void {
    try { this.map?.remove(); } catch { /* ignore */ }
  }

  // ── Public ───────────────────────────────────────────────────────────────

  recentrer(): void {
    if (!this.map) return;
    this.ngZone.runOutsideAngular(() => this.fitBounds(this.state.infrasFiltrees()));
  }

  invalidateSize(): void {
    this.ngZone.runOutsideAngular(() => this.map?.invalidateSize());
  }

  // ── Rendering helpers ────────────────────────────────────────────────────

  private renderMarqueurs(infras: Infrastructure[], selected: Infrastructure | null): void {
    this.marqueursCouche?.clearLayers();
    if (!this.marqueursCouche) return;

    for (const infra of infras) {
      if (!infra.lat || !infra.lon) continue;

      const isSelected = infra.id === selected?.id;
      const color      = STATUS_COLORS[infra.status] ?? '#94a3b8';
      const critical   = infra.status === 'critique' || infra.status === 'hors-service';
      const sz         = isSelected ? 20 : (critical ? 15 : 12);

      const pulse = critical
        ? `<div style="position:absolute;inset:0;background:${color};border-radius:50%;opacity:.3;animation:ci-pulse 1.8s ease-in-out infinite"></div>`
        : '';
      const ring = isSelected
        ? `<div style="position:absolute;inset:-3px;border:2px solid ${color};border-radius:50%;opacity:.5"></div>`
        : '';
      const dot  = `<div style="position:absolute;inset:${isSelected ? 2 : 1}px;background:${color};border:${isSelected ? 3 : 2}px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.45)"></div>`;
      const html = `<div style="position:relative;width:${sz}px;height:${sz}px">${pulse}${ring}${dot}</div>`;

      const icon   = L.divIcon({ html, className: '', iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2] });
      const marker = L.marker([infra.lat, infra.lon], { icon, zIndexOffset: isSelected ? 1000 : (critical ? 500 : 0) });

      marker.bindTooltip(
        `<div style="font-size:12px;font-weight:600;color:#1e293b">${infra.code}</div>` +
        `<div style="font-size:11px;color:#475569;margin-top:2px">${infra.name}</div>` +
        `<div style="font-size:10px;color:#64748b;margin-top:1px">${infra.commune ?? ''}${infra.department ? ', ' + infra.department : ''}</div>`,
        { opacity: 0.97, direction: 'top' }
      );

      marker.on('click', () =>
        this.ngZone.run(() => this.state.selectionner(isSelected ? null : infra))
      );

      marker.addTo(this.marqueursCouche);
    }
  }

  private renderLiaisons(infras: Infrastructure[]): void {
    this.liaisonsCouche?.clearLayers();
    if (!this.liaisonsCouche) return;

    const byCode: Record<string, Infrastructure> = {};
    for (const i of infras) byCode[i.code] = i;

    for (const infra of infras) {
      if (!infra.lat || !infra.lon || !infra.upstreamCode) continue;
      const amont = byCode[infra.upstreamCode];
      if (!amont?.lat || !amont?.lon) continue;

      L.polyline(
        [[amont.lat, amont.lon], [infra.lat, infra.lon]],
        { color: '#3B82F6', weight: 2, opacity: 0.55, dashArray: '6 4' }
      ).addTo(this.liaisonsCouche);

      // Arrowhead at destination
      const midLat = (amont.lat + infra.lat) / 2;
      const midLon = (amont.lon + infra.lon) / 2;
      const arrowIcon = L.divIcon({
        html: `<div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:7px solid rgba(59,130,246,.7);transform:rotate(${this.bearing({ lat: amont.lat!, lon: amont.lon! }, { lat: infra.lat!, lon: infra.lon! })}deg)"></div>`,
        className: '',
        iconSize: [8, 7],
        iconAnchor: [4, 3],
      });
      L.marker([midLat, midLon], { icon: arrowIcon, interactive: false }).addTo(this.liaisonsCouche);
    }
  }

  private bearing(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
    const dLon  = (to.lon - from.lon) * Math.PI / 180;
    const lat1  = from.lat * Math.PI / 180;
    const lat2  = to.lat  * Math.PI / 180;
    const y     = Math.sin(dLon) * Math.cos(lat2);
    const x     = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  private fitBounds(infras: Infrastructure[]): void {
    if (!this.map) return;
    const pts = infras.filter(i => i.lat && i.lon);
    if (!pts.length) {
      this.map.setView(HAITI_CENTER, HAITI_ZOOM, { animate: true });
      return;
    }
    const lats = pts.map(i => i.lat!);
    const lons = pts.map(i => i.lon!);
    this.map.fitBounds(
      [
        [Math.min(...lats) - 0.05, Math.min(...lons) - 0.05],
        [Math.max(...lats) + 0.05, Math.max(...lons) + 0.05],
      ],
      { maxZoom: 14, animate: true }
    );
  }

  // ── Template helpers ──────────────────────────────────────────────────────
  statusColor(s: string): string { return STATUS_COLORS[s] ?? '#94a3b8'; }
  statusBg(s: string):    string { return (STATUS_COLORS[s] ?? '#94a3b8') + '1a'; }

  statusLabel(s: string): string {
    return ({
      'en-service':   'En service',
      'hors-service': 'Hors service',
      'maintenance':  'Maintenance',
      'a-inspecter':  'À inspecter',
      critique:       'Critique',
      archive:        'Archivé',
    } as Record<string, string>)[s] ?? s;
  }
}
