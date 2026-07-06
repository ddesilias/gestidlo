import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HaitiGeoService, HAITI_DEPARTMENTS } from '../haiti-geo.service';

export interface TerritorySelection {
  dept: string;
  commune: string;
  section: string;
}

// ── TerritoryFilterComponent ─────────────────────────────────────────────────
// Reusable cascading dept → commune → section filter.
// Reads and writes state via HaitiGeoService signals (root singleton).
// Because the service is root-scoped, filter state persists across navigation:
// a user who selects Léogâne in Ressources sees it pre-selected in Alertes.
//
// Usage:
//   <app-territory-filter (filterChange)="onTerritoryChange($event)"/>
//
// The host page receives emissions AND can read territory.dept() / .commune() /
// .section() signals directly from its own injected HaitiGeoService instance.

@Component({
  selector: 'app-territory-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="tf-root">
  <div class="tf-header">
    <span class="tf-title">{{ label }}</span>
    <span class="tf-badge" *ngIf="geo.activeCount() > 0">{{ geo.activeCount() }}</span>
  </div>

  <!-- Département -->
  <div class="tf-group">
    <label class="tf-label">Département</label>
    <select class="tf-select" [ngModel]="geo.dept()" (ngModelChange)="onDept($event)">
      <option value="">Tous les départements</option>
      <option *ngFor="let d of depts" [value]="d">{{ d }}</option>
    </select>
  </div>

  <!-- Commune — enabled only when dept chosen -->
  <div class="tf-group">
    <label class="tf-label">Commune</label>
    <select class="tf-select" [ngModel]="geo.commune()" (ngModelChange)="onCommune($event)"
            [disabled]="!geo.dept()">
      <option value="">Toutes les communes</option>
      <option *ngFor="let c of communes()" [value]="c">{{ c }}</option>
    </select>
  </div>

  <!-- Section communale — enabled only when dept chosen -->
  <div class="tf-group">
    <label class="tf-label">Section communale</label>
    <select class="tf-select" [ngModel]="geo.section()" (ngModelChange)="onSection($event)"
            [disabled]="!geo.commune()">
      <option value="">Toutes les sections</option>
      <option *ngFor="let s of sections()" [value]="s">{{ s }}</option>
    </select>
    <span class="tf-hint" *ngIf="!geo.commune()">Choisissez d'abord une commune</span>
  </div>

  <!-- Reset -->
  <button class="tf-reset" type="button" *ngIf="geo.activeCount() > 0" (click)="onReset()">
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.32"/></svg>
    Réinitialiser
  </button>
</div>
  `,
  styles: []
})
export class TerritoryFilterComponent {
  @Input() label = 'Filtre territorial';
  @Output() filterChange = new EventEmitter<TerritorySelection>();

  readonly depts = HAITI_DEPARTMENTS;

  constructor(readonly geo: HaitiGeoService) {}

  communes(): string[] {
    return this.geo.communesForDept(this.geo.dept());
  }

  sections(): string[] {
    return this.geo.sectionsForScope(this.geo.commune(), this.geo.dept());
  }

  onDept(v: string): void {
    this.geo.setDept(v);
    this.emit();
  }

  onCommune(v: string): void {
    this.geo.setCommune(v);
    this.emit();
  }

  onSection(v: string): void {
    this.geo.setSection(v);
    this.emit();
  }

  onReset(): void {
    this.geo.reset();
    this.emit();
  }

  private emit(): void {
    this.filterChange.emit({
      dept: this.geo.dept(),
      commune: this.geo.commune(),
      section: this.geo.section(),
    });
  }
}
