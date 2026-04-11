import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { GeoJsonFeatureCollection } from '../territories.service';
import { PointDefinition } from '../points.service';

declare const L: any;

@Component({
  selector: 'app-leaflet-point-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="leaflet-wrap">
      <div #map class="leaflet" aria-label="Map"></div>
      <div class="leaflet-fallback muted" *ngIf="!leafletAvailable">
        Carte indisponible (Leaflet non chargé). Vérifie la connexion Internet.
      </div>
    </div>
  `
})
export class LeafletPointPickerComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('map', { static: true }) private readonly mapEl?: ElementRef<HTMLDivElement>;

  @Input() geojson: GeoJsonFeatureCollection | null = null;
  @Input() idProperty = 'name';
  @Input() points: PointDefinition[] = [];
  @Input() selectedPointId?: string;

  @Output() selectedPointIdChange = new EventEmitter<string>();
  @Output() coordsChange = new EventEmitter<{ id: string; lon: number; lat: number }>();

  leafletAvailable = true;
  private map?: any;
  private geoLayer?: any;
  private markerLayer?: any;
  private selectedMarker?: any;

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

    this.map = L.map(el, { zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this.map);

    const haitiBounds = L.latLngBounds([17.7, -75.0], [20.2, -71.0]);
    this.map.fitBounds(haitiBounds, { padding: [12, 12] });

    this.map.on('click', (e: any) => {
      const id = this.selectedPointId;
      if (!id) return;
      const lat = Number(e?.latlng?.lat);
      const lon = Number(e?.latlng?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      this.coordsChange.emit({ id, lon, lat });
    });

    this.rebuildGeo();
    this.rebuildMarkers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;
    if (changes['geojson']) {
      this.rebuildGeo();
    }
    if (changes['points'] || changes['selectedPointId']) {
      this.rebuildMarkers();
    }
  }

  ngOnDestroy(): void {
    try {
      this.map?.remove();
    } catch {
      // ignore
    }
  }

  private rebuildGeo() {
    if (!this.map) return;
    if (this.geoLayer) {
      this.geoLayer.remove();
      this.geoLayer = undefined;
    }
    if (!this.geojson) return;

    this.geoLayer = L.geoJSON(this.geojson as any, {
      style: () => ({ color: 'rgba(2,6,23,0.18)', weight: 1, fillOpacity: 0.08, fillColor: '#60a5fa' })
    }).addTo(this.map);
  }

  private rebuildMarkers() {
    if (!this.map) return;
    if (this.markerLayer) {
      this.markerLayer.remove();
      this.markerLayer = undefined;
    }

    this.markerLayer = L.layerGroup();
    this.selectedMarker = undefined;

    for (const p of this.points ?? []) {
      if (!p.active) continue;
      if (typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
      const icon = L.divIcon({
        className: 'leaflet-pin',
        html: `<div class="leaflet-pin__dot" style="background:${p.id === this.selectedPointId ? '#2563eb' : '#64748b'}"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      const marker = L.marker([p.lat, p.lon], { icon });
      marker.on('click', () => this.selectedPointIdChange.emit(p.id));
      marker.bindTooltip(p.name ?? p.id, { direction: 'top', offset: [0, -8] });
      marker.addTo(this.markerLayer);

      if (p.id === this.selectedPointId) {
        this.selectedMarker = marker;
      }
    }

    this.markerLayer.addTo(this.map);
    if (this.selectedMarker) {
      try {
        this.selectedMarker.openTooltip();
      } catch {
        // ignore
      }
    }
  }
}

