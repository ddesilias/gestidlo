import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { BffApiService } from '../api/bff-api.service';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { PointTypesService } from '../point-types.service';
import { PointDefinition, PointsService } from '../points.service';
import { ToastService } from '../ui/toast.service';
import { TerritoriesService, GeoJsonFeatureCollection } from '../territories.service';
import { LeafletPointPickerComponent } from '../ui/leaflet-point-picker.component';

@Component({
  selector: 'app-points-config-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, LeafletPointPickerComponent],
  template: `
    <h2>{{ 'reference.points.title' | t }}</h2>

    <section class="card">
      <h3 style="margin-top: 0">{{ 'common.add' | t }}</h3>
      <div class="row">
        <label>
          {{ 'table.id' | t }}
          <input [(ngModel)]="draft.id" placeholder="POINT-004" />
        </label>
        <label>
          {{ 'table.point' | t }}
          <input [(ngModel)]="draft.name" placeholder="KIOSK-04" />
        </label>
        <label>
          {{ 'table.type' | t }}
          <select [(ngModel)]="draft.type">
            <option *ngFor="let t of pointTypeCodes" [value]="t">{{ pointTypeLabel(t) }}</option>
          </select>
        </label>
        <label>
          {{ 'table.territory' | t }}
          <input [(ngModel)]="draft.territory" placeholder="Ouest" />
        </label>
        <label>
          Lon
          <input type="number" [(ngModel)]="draft.lon" placeholder="-72.28" />
        </label>
        <label>
          Lat
          <input type="number" [(ngModel)]="draft.lat" placeholder="18.55" />
        </label>
        <label>
          {{ 'table.description' | t }}
          <input [(ngModel)]="draft.description" />
        </label>
        <label>
          {{ 'table.active' | t }}
          <input type="checkbox" [(ngModel)]="draft.active" />
        </label>
      </div>
      <div class="actions">
        <button class="btn" (click)="create()">{{ 'common.add' | t }}</button>
      </div>
    </section>

    <section class="card">
      <h3 style="margin-top: 0">{{ 'common.view' | t }}</h3>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>{{ 'table.id' | t }}</th>
              <th>{{ 'table.point' | t }}</th>
              <th>{{ 'table.type' | t }}</th>
              <th>{{ 'table.territory' | t }}</th>
              <th>Lon</th>
              <th>Lat</th>
              <th>{{ 'table.description' | t }}</th>
              <th>{{ 'table.active' | t }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of items">
              <td style="font-weight: 900"><code>{{ p.id }}</code></td>
              <td><input [(ngModel)]="p.name" /></td>
              <td>
                <select [(ngModel)]="p.type">
                  <option *ngFor="let t of pointTypeCodes" [value]="t">{{ pointTypeLabel(t) }}</option>
                </select>
              </td>
              <td><input [(ngModel)]="p.territory" /></td>
              <td><input type="number" [(ngModel)]="p.lon" /></td>
              <td><input type="number" [(ngModel)]="p.lat" /></td>
              <td><input [(ngModel)]="p.description" /></td>
              <td style="text-align: center"><input type="checkbox" [(ngModel)]="p.active" /></td>
              <td class="actions-cell">
                <div class="actions actions--table">
                  <button class="btn btn--secondary" (click)="save(p)">{{ 'common.save' | t }}</button>
                  <button class="btn btn--danger" (click)="remove(p)">{{ 'common.delete' | t }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <h3 style="margin-top: 0">{{ 'reference.points.geo.title' | t }}</h3>
      <p class="muted" style="margin-top: 0">{{ 'reference.points.geo.help' | t }}</p>

      <div class="row">
        <label>
          {{ 'reference.points.geo.selectPoint' | t }}
          <select [(ngModel)]="geoPointId">
            <option *ngFor="let p of items" [value]="p.id">{{ p.name }} ({{ p.id }})</option>
          </select>
        </label>
        <label>
          Lon
          <input type="number" [ngModel]="geoLon" (ngModelChange)="geoLon = $any($event)" />
        </label>
        <label>
          Lat
          <input type="number" [ngModel]="geoLat" (ngModelChange)="geoLat = $any($event)" />
        </label>
        <div class="actions" style="align-self: end">
          <button class="btn" type="button" (click)="applyGeo()">{{ 'reference.points.geo.save' | t }}</button>
        </div>
      </div>

      <app-leaflet-point-picker
        [geojson]="territoryGeoJson"
        [points]="items"
        [selectedPointId]="geoPointId"
        (selectedPointIdChange)="onPickPoint($event)"
        (coordsChange)="onPickCoords($event)"
      />
    </section>
  `
})
export class PointsConfigPageComponent implements OnDestroy {
  items: PointDefinition[] = [];
  pointTypeCodes: string[] = ['KIOSK', 'SCHOOL', 'TANK', 'SOURCE'];

  draft: Partial<PointDefinition> = {
    id: '',
    name: '',
    type: 'KIOSK',
    territory: '',
    lon: null,
    lat: null,
    description: '',
    active: true
  };

  private pointsSub?: Subscription;
  private typesSub?: Subscription;
  private geoSub?: Subscription;

  territoryGeoJson: GeoJsonFeatureCollection | null = null;

  geoPointId = '';
  geoLon: number | null = null;
  geoLat: number | null = null;

  constructor(
    private readonly api: BffApiService,
    private readonly points: PointsService,
    private readonly pointTypes: PointTypesService,
    private readonly toast: ToastService,
    private readonly i18n: I18nService,
    private readonly territories: TerritoriesService
  ) {
    this.pointsSub = this.points.stream().subscribe((rows) => {
      this.items = (rows ?? []).map((p) => ({ ...p }));

		  if (!this.geoPointId && this.items.length) {
			  this.onPickPoint(this.items[0].id);
		  }
    });

    this.territories.ensureLoaded().subscribe();
    this.geoSub = this.territories.stream().subscribe((geojson) => {
      this.territoryGeoJson = geojson;
    });

    this.pointTypes.ensureLoaded().subscribe();
    this.typesSub = this.pointTypes.stream().subscribe((types) => {
      const codes = (types ?? []).filter((t) => t.active).map((t) => t.code);
      if (codes.length) {
        this.pointTypeCodes = codes;
        if (!this.pointTypeCodes.includes(String(this.draft.type))) {
          this.draft.type = this.pointTypeCodes[0];
        }
      }
    });

    this.points.reload().subscribe();
  }

  private showError(err: any) {
    const msg = err?.error?.message || err?.error?.error || this.i18n.t('toast.failed');
    this.toast.push('error', msg);
  }

  pointTypeLabel(code: string): string {
    return this.pointTypes.label(code);
  }

  create() {
    const id = (this.draft.id ?? '').trim();
    if (!id) {
      this.toast.push('error', `${this.i18n.t('table.id')} ${this.i18n.t('common.required')}`);
      return;
    }

    this.api
      .upsertReferencePoint(id, {
        name: this.draft.name ?? null,
        type: String(this.draft.type ?? '').trim().toUpperCase() || null,
        territory: this.draft.territory ?? null,
        lon: typeof this.draft.lon === 'number' ? this.draft.lon : null,
        lat: typeof this.draft.lat === 'number' ? this.draft.lat : null,
        description: this.draft.description ?? null,
        active: this.draft.active ?? true
      })
      .subscribe({
        next: () => {
          this.toast.push('success', this.i18n.t('common.saved'));
          this.draft = {
            id: '',
            name: '',
            type: this.pointTypeCodes[0] ?? 'KIOSK',
            territory: '',
            lon: null,
            lat: null,
            description: '',
            active: true
          };
          this.points.reload().subscribe();
        },
        error: (err) => this.showError(err)
      });
  }

  save(p: PointDefinition) {
    this.api
      .upsertReferencePoint(p.id, {
        name: p.name ?? null,
        type: (p.type ?? '').trim().toUpperCase() || null,
        territory: p.territory ?? null,
        lon: typeof p.lon === 'number' ? p.lon : null,
        lat: typeof p.lat === 'number' ? p.lat : null,
        description: p.description ?? null,
        active: p.active
      })
      .subscribe({
        next: () => {
          this.toast.push('success', this.i18n.t('common.saved'));
          this.points.reload().subscribe();
        },
        error: (err) => this.showError(err)
      });
  }

  remove(p: PointDefinition) {
    this.api.deleteReferencePoint(p.id).subscribe({
      next: () => {
        this.toast.push('success', this.i18n.t('common.saved'));
        this.points.reload().subscribe();
      },
      error: (err) => this.showError(err)
    });
  }

  onPickPoint(pointId: string) {
    this.geoPointId = pointId;
    const found = this.items.find((p) => p.id === pointId);
    this.geoLon = (typeof found?.lon === 'number' ? found?.lon : null) as any;
    this.geoLat = (typeof found?.lat === 'number' ? found?.lat : null) as any;
  }

  onPickCoords(e: { id: string; lon: number; lat: number }) {
    this.geoPointId = e.id;
    this.geoLon = e.lon;
    this.geoLat = e.lat;
  }

  applyGeo() {
    const p = this.items.find((r) => r.id === this.geoPointId);
    if (!p) {
      return;
    }
    p.lon = this.geoLon;
    p.lat = this.geoLat;
    this.save(p);
  }

  ngOnDestroy(): void {
    this.pointsSub?.unsubscribe();
    this.typesSub?.unsubscribe();
    this.geoSub?.unsubscribe();
  }
}
