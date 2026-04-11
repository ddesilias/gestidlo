import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';

export type GeoJsonPolygon = {
  type: 'Polygon';
  coordinates: number[][][];
};

export type GeoJsonMultiPolygon = {
  type: 'MultiPolygon';
  coordinates: number[][][][];
};

export type GeoJsonGeometry = GeoJsonPolygon | GeoJsonMultiPolygon;

export type GeoJsonFeature = {
  type: 'Feature';
  properties?: Record<string, any> | null;
  geometry: GeoJsonGeometry | null;
};

export type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
};

@Injectable({ providedIn: 'root' })
export class TerritoriesService {
  private readonly subject = new BehaviorSubject<GeoJsonFeatureCollection | null>(null);
  private loaded = false;
  private inFlight?: Observable<GeoJsonFeatureCollection | null>;

  constructor(private readonly http: HttpClient) {}

  stream(): Observable<GeoJsonFeatureCollection | null> {
    return this.subject.asObservable();
  }

  snapshot(): GeoJsonFeatureCollection | null {
    return this.subject.value;
  }

  ensureLoaded(url = '/geo/territories.geojson'): Observable<GeoJsonFeatureCollection | null> {
    if (this.loaded) {
      return this.subject.asObservable();
    }
    if (!this.inFlight) {
      this.inFlight = this.reload(url);
    }
    return this.inFlight;
  }

  reload(url = '/geo/territories.geojson'): Observable<GeoJsonFeatureCollection | null> {
    return this.http.get<GeoJsonFeatureCollection>(url).pipe(
      catchError(() => of(null)),
      tap((geojson) => {
        this.loaded = true;
        this.inFlight = undefined;
        this.subject.next(geojson);
      })
    );
  }
}

