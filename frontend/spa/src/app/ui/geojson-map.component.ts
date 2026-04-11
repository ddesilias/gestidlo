import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GeoJsonFeature, GeoJsonFeatureCollection, GeoJsonGeometry } from '../territories.service';

export type TerritoryStatus = 'OK' | 'WARN' | 'CRIT' | 'OFFLINE' | 'UNKNOWN';

export type GeoMarker = {
  id: string;
  lon: number;
  lat: number;
  label?: string;
  state?: TerritoryStatus;
};

	@Component({
  selector: 'app-geojson-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="geo-map" *ngIf="geojson?.features?.length; else empty" role="group" aria-label="Territory map">
      <svg class="geo-map__svg" [attr.viewBox]="viewBox" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(2, 132, 199, 0.08)" />
        <g>
          <path
            *ngFor="let f of geojson!.features"
            class="geo-map__feature"
            [class.geo-map__feature--selected]="featureId(f) === selectedId"
            [attr.d]="pathFor(f.geometry)"
            [attr.fill]="fillFor(featureId(f))"
            (click)="onSelect(f)"
          >
	            <title>{{ titleFor(featureId(f)) }}</title>
	          </path>
	        </g>

	        <g class="geo-map__markers" *ngIf="markers?.length">
	          <g
	            class="geo-map__marker"
	            *ngFor="let m of markers"
	            [class.geo-map__marker--selected]="m.id === selectedMarkerId"
	            [attr.transform]="markerTransform(m)"
	            (click)="onMarkerSelect(m)"
	          >
	            <path
	              d="M12 2c-3.87 0-7 3.13-7 7 0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"
	              [attr.fill]="markerFill(m.state)"
	              stroke="rgba(255,255,255,0.9)"
	              stroke-width="1.2"
	            />
	            <title>{{ markerTitle(m) }}</title>
	          </g>
	        </g>
	      </svg>
	    </div>

    <ng-template #empty>
      <div class="muted">GeoJSON manquant. Ajoute frontend/spa/public/geo/territories.geojson.</div>
    </ng-template>
  `
})
export class GeoJsonMapComponent {
  @Input({ required: true }) geojson: GeoJsonFeatureCollection | null = null;
  @Input() idProperty = 'name';
  @Input() status: Record<string, TerritoryStatus> = {};
	  @Input() selectedId?: string;
	  @Input() titleForId?: (id: string) => string;
	  @Input() markers: GeoMarker[] = [];
	  @Input() selectedMarkerId?: string;
	  @Output() markerSelect = new EventEmitter<string>();
	  @Output() select = new EventEmitter<string>();

  private readonly width = 1000;
  private readonly height = 560;
  private readonly pad = 20;

  get viewBox(): string {
    return `0 0 ${this.width} ${this.height}`;
  }

  featureId(f: GeoJsonFeature): string {
    const props = f.properties ?? {};
    const value = (props as any)[this.idProperty];
    return value == null ? '' : String(value);
  }

  titleFor(id: string): string {
    if (!id) return '';
    return this.titleForId ? this.titleForId(id) : id;
  }

  onSelect(f: GeoJsonFeature) {
    const id = this.featureId(f);
    if (id) {
      this.select.emit(id);
    }
  }

	  fillFor(id: string): string {
    const s = this.status[id] ?? 'UNKNOWN';
    if (s === 'CRIT') return 'rgba(220, 38, 38, 0.75)';
    if (s === 'WARN') return 'rgba(245, 158, 11, 0.75)';
    if (s === 'OK') return 'rgba(22, 163, 74, 0.65)';
    if (s === 'OFFLINE') return 'rgba(148, 163, 184, 0.55)';
    return 'rgba(226, 232, 240, 0.85)';
	  }

	  markerFill(state?: TerritoryStatus): string {
	    const s = state ?? 'UNKNOWN';
	    if (s === 'CRIT') return '#dc2626';
	    if (s === 'WARN') return '#f59e0b';
	    if (s === 'OK') return '#16a34a';
	    if (s === 'OFFLINE') return '#94a3b8';
	    return '#64748b';
	  }

  markerTransform(marker: GeoMarker): string {
    const bounds = this.boundsOfCollection(this.geojson);
    if (!bounds) return '';
    const p = this.project(marker.lon, marker.lat, bounds);
    // Path is designed around a 24x24 viewBox with origin (0,0).
    return `translate(${(p.x - 12).toFixed(2)} ${(p.y - 24).toFixed(2)}) scale(1.05)`;
  }

	  markerTitle(marker: GeoMarker): string {
	    const base = marker.label ? `${marker.label} (${marker.id})` : marker.id;
	    return base;
	  }

	  onMarkerSelect(marker: GeoMarker) {
	    this.markerSelect.emit(marker.id);
	  }

  pathFor(geometry: GeoJsonGeometry | null): string {
    if (!geometry) return '';
    const bounds = this.boundsOfCollection(this.geojson);
    if (!bounds) return '';

    if (geometry.type === 'Polygon') {
      return this.pathForPolygon(geometry.coordinates, bounds);
    }
    if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.map((p) => this.pathForPolygon(p, bounds)).join(' ');
    }
    return '';
  }

  private pathForPolygon(rings: number[][][], bounds: Bounds): string {
    const paths: string[] = [];
    for (const ring of rings ?? []) {
      if (!ring?.length) continue;
      const points = ring.map((c) => this.project(c[0], c[1], bounds));
      const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
      paths.push(`${d} Z`);
    }
    return paths.join(' ');
  }

  private boundsOfCollection(fc: GeoJsonFeatureCollection | null): Bounds | null {
    if (!fc?.features?.length) return null;
    let minLon = Number.POSITIVE_INFINITY;
    let maxLon = Number.NEGATIVE_INFINITY;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;

    const push = (lon: number, lat: number) => {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    };

    for (const f of fc.features) {
      const g = f.geometry;
      if (!g) continue;
      if (g.type === 'Polygon') {
        for (const ring of g.coordinates ?? []) {
          for (const c of ring ?? []) push(c[0], c[1]);
        }
      }
      if (g.type === 'MultiPolygon') {
        for (const poly of g.coordinates ?? []) {
          for (const ring of poly ?? []) {
            for (const c of ring ?? []) push(c[0], c[1]);
          }
        }
      }
    }

    if (!Number.isFinite(minLon) || !Number.isFinite(maxLon) || !Number.isFinite(minLat) || !Number.isFinite(maxLat)) {
      return null;
    }
    const lonRange = Math.max(1e-9, maxLon - minLon);
    const latRange = Math.max(1e-9, maxLat - minLat);

    return { minLon, maxLon, minLat, maxLat, lonRange, latRange };
  }

  private project(lon: number, lat: number, b: Bounds): { x: number; y: number } {
    const innerW = this.width - this.pad * 2;
    const innerH = this.height - this.pad * 2;
    const x = this.pad + ((lon - b.minLon) / b.lonRange) * innerW;
    const y = this.pad + ((b.maxLat - lat) / b.latRange) * innerH;
    return { x, y };
  }
}

type Bounds = {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  lonRange: number;
  latRange: number;
};
