import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component,
  ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  GeoMapItem, GeoLegendItem,
  HYDRO_TILE_URL, HYDRO_TILE_OPTS,
  HAITI_CENTER, HAITI_ZONE_ZOOM,
} from '../map.config';

declare const L: any;

@Component({
  selector: 'app-gestidlo-map',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="gmap-shell">
  <!-- Map canvas -->
  <div #mapEl class="gmap-canvas" aria-label="Carte GEstiDlo"></div>

  <!-- Fallback: Leaflet unavailable -->
  <div class="gmap-fallback" *ngIf="!leafletOk">
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
    <span>Carte indisponible (Leaflet non chargé)</span>
  </div>

  <!-- Toolbar -->
  <div class="gmap-toolbar" *ngIf="leafletOk">
    <button class="gmap-btn" type="button" title="Recentrer" (click)="reCenter()">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>
    </button>
    <button class="gmap-btn" type="button" title="Légende" [class.gmap-btn--active]="showLegend" (click)="showLegend = !showLegend" *ngIf="legend.length > 0">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><circle cx="17.5" cy="17.5" r="3.5"/></svg>
    </button>
  </div>

  <!-- Legend panel -->
  <div class="gmap-legend" *ngIf="leafletOk && showLegend && legend.length > 0">
    <div class="gmap-legend__title" *ngIf="legendTitle">{{ legendTitle }}</div>
    <div class="gmap-legend__row" *ngFor="let item of legend">
      <span class="gmap-legend__sym"
        [class.gmap-legend__sym--line]="item.shape === 'line'"
        [class.gmap-legend__sym--square]="item.shape === 'square'"
        [style.background]="item.shape !== 'line' ? item.color : 'transparent'"
        [style.border-bottom]="item.shape === 'line' ? '2.5px solid ' + item.color : ''">
      </span>
      <span class="gmap-legend__label">{{ item.label }}</span>
    </div>
  </div>

  <!-- Attribution -->
  <div class="gmap-attr" *ngIf="leafletOk">
    &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>
    &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>
  </div>
</div>
  `,
  styles: [`
    :host { display:block; position:relative; height:100%; width:100%; }
    .gmap-shell { position:relative; height:100%; width:100%; overflow:hidden; background:#e8edf2; }
    .gmap-canvas { height:100%; width:100%; }
    .gmap-fallback { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.6rem; color:#94a3b8; font-size:.8rem; background:#f1f5f9; }
    /* Toolbar */
    .gmap-toolbar { position:absolute; top:.6rem; left:.6rem; z-index:500; display:flex; flex-direction:column; gap:.3rem; }
    .gmap-btn { width:30px; height:30px; border-radius:8px; border:1px solid rgba(0,0,0,.12); background:rgba(255,255,255,.92); backdrop-filter:blur(4px); cursor:pointer; display:flex; align-items:center; justify-content:center; color:#475569; box-shadow:0 2px 6px rgba(0,0,0,.1); transition:all .15s; }
    .gmap-btn:hover { background:#fff; color:#2563eb; border-color:#bfdbfe; }
    .gmap-btn--active { background:#eff6ff; border-color:#3b82f6; color:#2563eb; }
    /* Legend */
    .gmap-legend { position:absolute; bottom:.7rem; right:.7rem; z-index:500; background:rgba(255,255,255,.94); backdrop-filter:blur(4px); border:1px solid rgba(0,0,0,.1); border-radius:10px; padding:.65rem .85rem; font-size:.72rem; color:#1e293b; box-shadow:0 2px 10px rgba(0,0,0,.1); min-width:148px; }
    .gmap-legend__title { font-weight:700; font-size:.68rem; text-transform:uppercase; letter-spacing:.04em; color:#475569; margin-bottom:.4rem; }
    .gmap-legend__row { display:flex; align-items:center; gap:.4rem; margin-bottom:.22rem; line-height:1.4; }
    .gmap-legend__sym { display:inline-block; width:10px; height:10px; border-radius:50%; flex-shrink:0; }
    .gmap-legend__sym--square { border-radius:2px; }
    .gmap-legend__sym--line { width:18px; height:1px; background:transparent; margin:0; }
    .gmap-legend__label { font-size:.73rem; }
    /* Attribution */
    .gmap-attr { position:absolute; bottom:.25rem; left:.5rem; z-index:400; font-size:.6rem; color:#64748b; }
    .gmap-attr a { color:#64748b; }
  `],
})
export class GestidloMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapEl', { static: true }) private mapEl!: ElementRef<HTMLDivElement>;

  @Input() items: GeoMapItem[] = [];
  @Input() legend: GeoLegendItem[] = [];
  @Input() legendTitle = '';
  @Input() selectedId?: string;
  @Input() centerOnChange = true;

  @Output() itemSelected = new EventEmitter<string>();
  @Output() mapReady = new EventEmitter<void>();

  leafletOk = false;
  showLegend = true;

  private map: any;
  private layerGroup: any;
  private initializedOnce = false;

  constructor(private readonly ngZone: NgZone, private readonly cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    if (typeof L === 'undefined') return;

    this.leafletOk = true;
    this.ngZone.runOutsideAngular(() => {
      this.map = L.map(this.mapEl.nativeElement, {
        center: HAITI_CENTER,
        zoom: HAITI_ZONE_ZOOM,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: 'topright' }).addTo(this.map);

      L.tileLayer(HYDRO_TILE_URL, HYDRO_TILE_OPTS).addTo(this.map);

      this.layerGroup = L.layerGroup().addTo(this.map);
      this.renderItems();
      this.initializedOnce = true;
    });

    this.cdr.markForCheck();
    this.mapReady.emit();
  }

  ngOnChanges(): void {
    if (!this.map || !this.initializedOnce) return;
    this.ngZone.runOutsideAngular(() => this.renderItems());
  }

  ngOnDestroy(): void {
    try { this.map?.remove(); } catch { /* ignore */ }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  reCenter(): void {
    if (!this.map) return;
    this.ngZone.runOutsideAngular(() => {
      const pts = this.items.filter(i => i.lat && i.lng);
      if (pts.length === 0) {
        this.map.setView(HAITI_CENTER, HAITI_ZONE_ZOOM, { animate: true });
        return;
      }
      const lats = pts.map(p => p.lat);
      const lngs = pts.map(p => p.lng);
      const bounds = L.latLngBounds(
        [Math.min(...lats) - 0.05, Math.min(...lngs) - 0.05],
        [Math.max(...lats) + 0.05, Math.max(...lngs) + 0.05],
      );
      this.map.fitBounds(bounds, { maxZoom: 14, animate: true });
    });
  }

  /** Call from parent to force a tile/size refresh (e.g. after panel resize) */
  invalidateSize(): void {
    this.ngZone.runOutsideAngular(() => this.map?.invalidateSize());
  }

  // ─── Rendering ───────────────────────────────────────────────────────────

  private renderItems(): void {
    if (!this.layerGroup) return;
    this.layerGroup.clearLayers();

    for (const item of this.items) {
      if (item.shape === 'zone') {
        this.renderZone(item);
      } else {
        this.renderDot(item);
      }
    }

    if (this.centerOnChange && this.items.length > 0) {
      const pts = this.items.filter(i => !this.selectedId || i.id !== this.selectedId);
      if (pts.length > 0) this.fitBoundsToItems(pts);
    }
  }

  private renderZone(item: GeoMapItem): void {
    const isSelected = item.id === this.selectedId;
    const circle = L.circle([item.lat, item.lng], {
      color: item.color,
      fillColor: item.color,
      fillOpacity: isSelected ? 0.35 : (item.fillOpacity ?? 0.2),
      weight: isSelected ? 3 : (item.weight ?? 2),
      radius: item.radius ?? 2500,
    });

    if (item.tooltip) circle.bindTooltip(item.tooltip, { direction: 'top', opacity: 0.9 });
    circle.on('click', () => this.ngZone.run(() => this.itemSelected.emit(item.id)));
    circle.addTo(this.layerGroup);

    if (item.label) {
      const labelIcon = L.divIcon({
        html: `<div style="font-size:11px;font-weight:700;color:#1e293b;white-space:nowrap;text-shadow:0 1px 2px #fff,0 -1px 2px #fff,1px 0 2px #fff,-1px 0 2px #fff">${item.label}</div>`,
        className: '', iconSize: null as any, iconAnchor: [-4, 6],
      });
      L.marker([item.lat, item.lng], { icon: labelIcon, interactive: false }).addTo(this.layerGroup);
    }
  }

  private renderDot(item: GeoMapItem): void {
    const isSelected = item.id === this.selectedId;
    const sz = isSelected ? ((item.size ?? 11) + 5) : (item.size ?? 11);

    const html = item.pulse
      ? `<div style="position:relative;width:${sz}px;height:${sz}px">
           <div style="position:absolute;inset:0;background:${item.color};border-radius:50%;opacity:.4;animation:gpulse 1.6s infinite"></div>
           <div style="position:absolute;inset:2px;background:${item.color};border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>
         </div>`
      : `<div style="width:${sz}px;height:${sz}px;background:${item.color};border:${isSelected ? '3px' : '2px'} solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.35)${isSelected ? ';outline:2px solid ' + item.color : ''}"></div>`;

    const icon = L.divIcon({
      html,
      className: '',
      iconSize: [sz, sz],
      iconAnchor: [sz / 2, sz / 2],
    });

    const marker = L.marker([item.lat, item.lng], { icon, zIndexOffset: item.zIndexOffset ?? (isSelected ? 1000 : 0) });
    if (item.tooltip) marker.bindTooltip(item.tooltip, { direction: 'top', opacity: 0.9 });
    marker.on('click', () => this.ngZone.run(() => this.itemSelected.emit(item.id)));
    marker.addTo(this.layerGroup);
  }

  private fitBoundsToItems(items: GeoMapItem[]): void {
    if (!this.map || items.length === 0) return;
    const lats = items.map(i => i.lat);
    const lngs = items.map(i => i.lng);
    const bounds = L.latLngBounds(
      [Math.min(...lats) - 0.05, Math.min(...lngs) - 0.05],
      [Math.max(...lats) + 0.05, Math.max(...lngs) + 0.05],
    );
    this.map.fitBounds(bounds, { maxZoom: 14, animate: true });
  }
}
