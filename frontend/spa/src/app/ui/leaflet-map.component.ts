import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, Output, ViewChild } from '@angular/core';
import { GeoJsonFeatureCollection } from '../territories.service';
import { GeoMarker, TerritoryStatus } from './geojson-map.component';

declare const L: any;

@Component({
  selector: 'app-leaflet-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="leaflet-wrap">
      <div #map class="leaflet" aria-label="Map"></div>
      <div class="leaflet-fallback muted" *ngIf="!leafletAvailable">
        Carte indisponible (Leaflet non chargé). Vérifie la connexion Internet.
      </div>
      <div class="leaflet-fallback muted" *ngIf="leafletAvailable && !tilesAvailable">
        Fond de carte indisponible (tuiles bloquées). Autorise l'accès à OpenStreetMap.
      </div>
    </div>
  `
})
export class LeafletMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('map', { static: true }) private readonly mapEl?: ElementRef<HTMLDivElement>;

  @Input() geojson: GeoJsonFeatureCollection | null = null;
  @Input() idProperty = 'name';
  @Input() status: Record<string, TerritoryStatus> = {};
  @Input() selectedTerritoryId?: string;

  @Input() markers: GeoMarker[] = [];
  @Input() selectedMarkerId?: string;
  @Input() resetViewKey?: string;

  @Output() territorySelect = new EventEmitter<string>();
  @Output() markerSelect = new EventEmitter<string>();

  leafletAvailable = true;
  tilesAvailable = true;
  private map?: any;
  private geoLayer?: any;
  private markerLayer?: any;
  private userInteracted = false;
  private fittedOnce = false;

  constructor(private readonly ngZone: NgZone) {}

  ngAfterViewInit(): void {
    if (typeof L === 'undefined') {
      this.leafletAvailable = false;
      return;
    }

    const el = this.mapEl?.nativeElement;
    if (!el) {
      this.leafletAvailable = false;
      return;
    }

    this.map = L.map(el, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
      dragging: true,
      doubleClickZoom: true,
      touchZoom: true
    });

    this.map.on('zoomstart', () => {
      this.userInteracted = true;
    });
    this.map.on('dragstart', () => {
      this.userInteracted = true;
    });

    // GEstiDlo HydroBase — fond hydrologique unifié
    const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    });
    tiles.on('tileerror', () => {
      this.tilesAvailable = false;
    });
    tiles.addTo(this.map);

    // Focus on Haiti by default.
    this.fitToMarkersOrHaiti(true);

    this.rebuildGeoLayer();
    this.rebuildMarkerLayer();
  }

  ngOnDestroy(): void {
    try {
      this.map?.remove();
    } catch {
      // ignore
    }
  }

  ngOnChanges(changes: any): void {
    if (!this.map) return;
    this.rebuildGeoLayer();
    this.rebuildMarkerLayer();
    this.highlightSelection();

    const resetKeyChanged = !!changes?.resetViewKey;
    if (resetKeyChanged) {
      this.userInteracted = false;
      this.fittedOnce = false;
    }

    this.fitToMarkersOrHaiti(false);
    this.panToSelectedMarkerIfNeeded();
  }

  private fitToMarkersOrHaiti(force: boolean) {
    if (!this.map) return;
    if (!force && (this.userInteracted || this.fittedOnce)) {
      return;
    }
    const markers = this.markers ?? [];
    const latlngs = markers
      .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lon))
      .map((m) => L.latLng(m.lat, m.lon));

    if (latlngs.length) {
      const bounds = L.latLngBounds(latlngs);
      this.map.fitBounds(bounds, { padding: [18, 18] });
      this.fittedOnce = true;
      return;
    }

    const haitiBounds = L.latLngBounds([17.7, -75.0], [20.2, -71.0]);
    this.map.fitBounds(haitiBounds, { padding: [12, 12] });
    this.fittedOnce = true;
  }

  private panToSelectedMarkerIfNeeded() {
    if (!this.map) return;
    const id = this.selectedMarkerId;
    if (!id) return;

    const marker = (this.markers ?? []).find((m) => m.id === id);
    if (!marker || !Number.isFinite(marker.lat) || !Number.isFinite(marker.lon)) {
      return;
    }

    const ll = L.latLng(marker.lat, marker.lon);
    const padded = this.map.getBounds().pad(-0.15);
    if (!padded.contains(ll)) {
      this.map.panTo(ll, { animate: true });
    }
  }

  private rebuildGeoLayer() {
    if (!this.map) return;
    if (this.geoLayer) {
      this.geoLayer.remove();
      this.geoLayer = undefined;
    }
    if (!this.geojson) return;

    this.geoLayer = L.geoJSON(this.geojson as any, {
      style: (feature: any) => {
        const id = String(feature?.properties?.[this.idProperty] ?? '');
        const s = this.status[id] ?? 'UNKNOWN';
        const fill = this.fillFor(s);
        return {
          color: 'rgba(2,6,23,0.20)',
          weight: 1,
          fillColor: fill,
          fillOpacity: 0.45
        };
      },
      onEachFeature: (feature: any, layer: any) => {
        const id = String(feature?.properties?.[this.idProperty] ?? '');
        layer.on('click', () => {
          if (id) this.ngZone.run(() => this.territorySelect.emit(id));
        });
        if (id) {
          layer.bindTooltip(id, { sticky: true });
        }
      }
    }).addTo(this.map);

    this.highlightSelection();
  }

  private rebuildMarkerLayer() {
    if (!this.map) return;
    if (this.markerLayer) {
      this.markerLayer.remove();
      this.markerLayer = undefined;
    }

    this.markerLayer = L.layerGroup();
    for (const m of this.markers ?? []) {
      if (!Number.isFinite(m.lat) || !Number.isFinite(m.lon)) continue;
      const color = this.markerColor(m.state);
      const icon = L.divIcon({
        className: 'leaflet-pin',
        html: `<div class="leaflet-pin__dot" style="background:${color}"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      const marker = L.marker([m.lat, m.lon], { icon });
      marker.on('click', () => this.ngZone.run(() => this.markerSelect.emit(m.id)));
      marker.bindTooltip(m.label ?? m.id, { direction: 'top', offset: [0, -8] });
      marker.addTo(this.markerLayer);
    }
    this.markerLayer.addTo(this.map);
  }

  private highlightSelection() {
    if (!this.geoLayer) return;
    this.geoLayer.eachLayer((layer: any) => {
      try {
        const id = String(layer?.feature?.properties?.[this.idProperty] ?? '');
        if (id && this.selectedTerritoryId && id === this.selectedTerritoryId) {
          layer.setStyle({ weight: 2.5, color: 'rgba(37,99,235,0.9)' });
        } else {
          layer.setStyle({ weight: 1, color: 'rgba(2,6,23,0.20)' });
        }
      } catch {
        // ignore
      }
    });
  }

  private fillFor(s: TerritoryStatus): string {
    if (s === 'CRIT') return 'rgba(220, 38, 38, 0.90)';
    if (s === 'WARN') return 'rgba(245, 158, 11, 0.90)';
    if (s === 'OK') return 'rgba(22, 163, 74, 0.85)';
    if (s === 'OFFLINE') return 'rgba(148, 163, 184, 0.75)';
    return 'rgba(226, 232, 240, 0.85)';
  }

  private markerColor(s?: TerritoryStatus): string {
    if (s === 'CRIT') return '#dc2626';
    if (s === 'WARN') return '#f59e0b';
    if (s === 'OK') return '#16a34a';
    if (s === 'OFFLINE') return '#94a3b8';
    return '#2563eb';
  }
}
