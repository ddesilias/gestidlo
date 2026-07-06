import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, forkJoin, catchError, of } from 'rxjs';

import { BffApiService } from '../api/bff-api.service';
import { ToastService } from '../ui/toast.service';
import { I18nService } from '../i18n/i18n.service';
import { PointsService } from '../points.service';
import { MeasurementTypesService } from '../measurement-types.service';
import { RefreshService } from '../refresh.service';
import { HaitiGeoService, HAITI_DEPARTMENTS } from '../haiti-geo.service';
import { GovernanceStore, Technicien } from '../governance.store';
import { InfrastructureStore } from '../infrastructure.store';

type AlertTab = 'all' | 'open' | 'progress' | 'critical' | 'resolved' | 'ignored';
type DetailTab = 'summary' | 'data' | 'suivi' | 'pieces';

@Component({
  selector: 'app-alerts-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
<div class="al-shell">

  <!-- ══════════════════════════════════════════════════
       HEADER
  ══════════════════════════════════════════════════ -->
  <div class="al-header">
    <div class="al-header__left">
      <h1 class="al-header__title">Alertes &amp; incidents</h1>
      <p class="al-header__sub">Suivi, priorisation et traitement des anomalies détectées sur le réseau AEP.</p>
      <div class="al-header__summary" *ngIf="allAlerts.length > 0">
        <span class="al-summary-item al-summary-item--open">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          {{ countFor('open') }} ouvertes
        </span>
        <span class="al-summary-sep">·</span>
        <span class="al-summary-item al-summary-item--crit" *ngIf="countFor('critical') > 0">
          {{ countFor('critical') }} critiques
        </span>
        <span class="al-summary-sep" *ngIf="countFor('critical') > 0">·</span>
        <span class="al-summary-item al-summary-item--progress" *ngIf="countFor('progress') > 0">
          {{ countFor('progress') }} en cours
        </span>
        <span class="al-summary-sep" *ngIf="countFor('progress') > 0">·</span>
        <span class="al-summary-item al-summary-item--muted">mis à jour {{ lastUpdateTime() }}</span>
      </div>
    </div>
    <div class="al-header__actions">
      <button class="al-btn al-btn--ghost" type="button">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Exporter
      </button>
      <button class="al-btn al-btn--primary" type="button" (click)="showCreateDrawer = true">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Créer une alerte
      </button>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════
       FILTER BAR
  ══════════════════════════════════════════════════ -->
  <div class="al-filterbar">
    <div class="al-search">
      <svg class="al-search__icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input class="al-search__input" type="text" [(ngModel)]="search"
        placeholder="Rechercher une alerte, un ouvrage, une commune...">
      <span class="al-search__kbd" *ngIf="!search">Ctrl K</span>
      <button class="al-search__clear" *ngIf="search" (click)="search = ''" type="button">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <select class="al-filter-select" [(ngModel)]="filterSeverity">
      <option value="">Gravité : Toutes</option>
      <option value="CRIT">Critique</option>
      <option value="WARN">Avertissement</option>
      <option value="INFO">Information</option>
    </select>

    <select class="al-filter-select" [(ngModel)]="filterType">
      <option value="">Type : Tous</option>
      <option *ngFor="let t of uniqueTypes()" [value]="t">{{ typeLabel(t) }}</option>
    </select>

    <select class="al-filter-select" [(ngModel)]="filterTerritory">
      <option value="">Département : Tous</option>
      <option *ngFor="let t of territories()" [value]="t">{{ t }}</option>
    </select>

    <select class="al-filter-select" [(ngModel)]="filterPeriod">
      <option value="1d">Période : Aujourd'hui</option>
      <option value="7d">7 derniers jours</option>
      <option value="30d">30 derniers jours</option>
      <option value="90d">90 derniers jours</option>
    </select>

    <button class="al-advanced-btn" type="button" (click)="showAdvancedFilters = !showAdvancedFilters">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
      Filtres avancés
    </button>
  </div>

  <!-- ══════════════════════════════════════════════════
       TABS
  ══════════════════════════════════════════════════ -->
  <div class="al-tabs">
    <button class="al-tab" [class.al-tab--active]="activeTab === 'all'" (click)="setTab('all')" type="button">
      Toutes <span class="al-tab__badge">{{ countFor('all') }}</span>
    </button>
    <button class="al-tab" [class.al-tab--active]="activeTab === 'open'" (click)="setTab('open')" type="button">
      Ouvertes <span class="al-tab__badge al-tab__badge--danger">{{ countFor('open') }}</span>
    </button>
    <button class="al-tab" [class.al-tab--active]="activeTab === 'progress'" (click)="setTab('progress')" type="button">
      En cours <span class="al-tab__badge al-tab__badge--warn">{{ countFor('progress') }}</span>
    </button>
    <button class="al-tab" [class.al-tab--active]="activeTab === 'critical'" (click)="setTab('critical')" type="button">
      Critiques <span class="al-tab__badge al-tab__badge--danger">{{ countFor('critical') }}</span>
    </button>
    <button class="al-tab" [class.al-tab--active]="activeTab === 'resolved'" (click)="setTab('resolved')" type="button">
      Résolues <span class="al-tab__badge al-tab__badge--ok">{{ countFor('resolved') }}</span>
    </button>
    <button class="al-tab" [class.al-tab--active]="activeTab === 'ignored'" (click)="setTab('ignored')" type="button">
      Ignorées <span class="al-tab__badge">0</span>
    </button>
  </div>

  <!-- ══════════════════════════════════════════════════
       SPLIT: LIST + DETAIL
  ══════════════════════════════════════════════════ -->
  <div class="al-split">

    <!-- ── Left: Alert list ─────────────────────────── -->
    <div class="al-list-col">

      <!-- Loading -->
      <div class="al-list-loading" *ngIf="loadingAlerts">
        <div class="al-spinner"></div>
        <span>Chargement des alertes…</span>
      </div>

      <!-- Empty state -->
      <div class="al-list-empty" *ngIf="!loadingAlerts && filteredAlerts().length === 0">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <p class="al-list-empty__title">Aucune alerte</p>
        <p class="al-list-empty__sub">Aucune alerte ne correspond aux filtres sélectionnés.</p>
      </div>

      <!-- Alert header row -->
      <div class="al-list-head" *ngIf="!loadingAlerts && filteredAlerts().length">
        <span></span>
        <span class="al-list-head__check"><input type="checkbox"></span>
        <span></span>
        <span>ALERTE</span>
        <span>OUVRAGE / LOCALISATION</span>
        <span>MESURE</span>
        <span>DÉTECTÉE</span>
        <span>STATUT</span>
        <span>RESPONSABLE</span>
        <span></span>
      </div>

      <!-- Alert cards -->
      <div class="al-card"
        *ngFor="let a of filteredAlerts()"
        (click)="selectAlert(a.id)"
        [class.al-card--selected]="selectedId === a.id"
        [class.al-card--crit]="a.severity === 'CRIT'"
        [class.al-card--warn]="a.severity === 'WARN'"
        [class.al-card--info]="a.severity === 'INFO' || !a.severity">

        <div class="al-card__bar"></div>

        <div class="al-card__check" (click)="$event.stopPropagation()">
          <input type="checkbox">
        </div>

        <!-- Severity icon -->
        <div class="al-card__sev-icon"
          [class.al-card__sev-icon--crit]="a.severity === 'CRIT'"
          [class.al-card__sev-icon--warn]="a.severity === 'WARN'"
          [class.al-card__sev-icon--info]="a.severity === 'INFO' || !a.severity">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" *ngIf="a.severity === 'CRIT' || a.severity === 'WARN'"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01"/></svg>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" *ngIf="a.severity !== 'CRIT' && a.severity !== 'WARN'"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>

        <!-- Main content -->
        <div class="al-card__content">
          <div class="al-card__type">{{ typeLabel(a.type) }}</div>
          <div class="al-card__sev-row">
            <span class="al-sev-badge al-sev-badge--crit" *ngIf="a.severity === 'CRIT'">Critique</span>
            <span class="al-sev-badge al-sev-badge--warn" *ngIf="a.severity === 'WARN'">Avertissement</span>
            <span class="al-sev-badge al-sev-badge--info" *ngIf="a.severity === 'INFO' || !a.severity">Information</span>
          </div>
        </div>

        <!-- Ouvrage -->
        <div class="al-card__point">
          <div class="al-card__point-name">{{ pointName(a.pointId) }}</div>
          <div class="al-card__point-loc" *ngIf="pointTerritory(a.pointId)">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {{ pointTerritory(a.pointId) }}
          </div>
        </div>

        <!-- Mesure -->
        <div class="al-card__measure">
          <span class="al-card__measure-val"
            [class.al-card__measure-val--crit]="a.severity === 'CRIT'"
            [class.al-card__measure-val--warn]="a.severity === 'WARN'">
            {{ measureLabel(a.type, 'current') }}
          </span>
          <span class="al-card__measure-thresh muted">Seuil : {{ measureLabel(a.type, 'crit') }}</span>
        </div>

        <!-- Detected -->
        <div class="al-card__age">
          <span>{{ alertAge(a.id) }}</span>
          <span class="al-card__date muted">{{ alertDateLabel(a.id) }}</span>
        </div>

        <!-- Status -->
        <div class="al-card__status">
          <span class="al-status-badge al-status-badge--active" *ngIf="a._apiStatus === 'ACTIVE'">Ouverte</span>
          <span class="al-status-badge al-status-badge--ack"    *ngIf="a._apiStatus === 'ACK'">En cours</span>
          <span class="al-status-badge al-status-badge--closed" *ngIf="a._apiStatus === 'CLOSED'">Résolue</span>
        </div>

        <!-- Assignee -->
        <div class="al-card__assignee muted">Non assigné</div>

        <!-- Row actions -->
        <div class="al-card__row-actions" (click)="$event.stopPropagation()">
          <button class="al-icon-btn" title="Voir sur la carte" type="button">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
          </button>
          <button class="al-icon-btn" title="Plus d'actions" type="button">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
        </div>
      </div>

      <!-- Pagination hint -->
      <div class="al-list-foot" *ngIf="!loadingAlerts && filteredAlerts().length">
        <span class="muted">Afficher 1 à {{ filteredAlerts().length }} sur {{ countFor(activeTab) }} alertes</span>
        <div class="al-list-foot__pages">
          <button class="al-page-btn" disabled type="button">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="al-page-current">1</span>
          <button class="al-page-btn" disabled type="button">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <select class="al-filter-select al-filter-select--sm">
          <option>10 / page</option>
          <option>25 / page</option>
          <option>50 / page</option>
        </select>
      </div>
    </div>

  </div>

</div><!-- .al-shell -->

<!-- ══════════════════════════════════════════════════
     DETAIL DRAWER + BACKDROP
══════════════════════════════════════════════════ -->
<div class="al-detail-backdrop" *ngIf="isDetailPanelOpen" (click)="closeDetail()"></div>

<div class="al-detail-drawer" [class.al-detail-drawer--open]="isDetailPanelOpen">
  <ng-container *ngIf="selectedAlert() as a">
    <div class="al-detail">

          <!-- Header fixe — white bg + left accent border -->
          <div class="al-detail__head"
            [class.al-detail__head--crit]="a.severity === 'CRIT'"
            [class.al-detail__head--warn]="a.severity === 'WARN'">
            <div class="al-detail__head-text">
              <div class="al-detail__head-title">{{ typeLabel(a.type) }}</div>
              <div class="al-detail__head-sub">
                {{ pointName(a.pointId) }}
                <span class="al-detail__head-type-badge">{{ pointTypeLabel(a.pointId) }}</span>
              </div>
            </div>
            <div class="al-detail__head-badges">
              <span class="al-sev-badge al-sev-badge--crit" *ngIf="a.severity === 'CRIT'">Critique</span>
              <span class="al-sev-badge al-sev-badge--warn" *ngIf="a.severity === 'WARN'">Avertissement</span>
              <span class="al-status-badge al-status-badge--active" *ngIf="a._apiStatus === 'ACTIVE'">Ouverte</span>
              <span class="al-status-badge al-status-badge--ack"    *ngIf="a._apiStatus === 'ACK'">En cours</span>
              <span class="al-status-badge al-status-badge--closed" *ngIf="a._apiStatus === 'CLOSED'">Résolue</span>
            </div>
            <button class="al-detail__close" (click)="closeDetail()" type="button">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- ID + priority meta line -->
          <div class="al-detail__meta">
            <span class="al-detail__id muted">ALT-2026-{{ a.id }}</span>
            <span class="al-prio-tag al-prio-tag--high" *ngIf="a.severity === 'CRIT'">Haute priorité</span>
            <span class="al-prio-tag al-prio-tag--med"  *ngIf="a.severity === 'WARN'">Priorité moyenne</span>
            <span class="al-prio-tag al-prio-tag--low"  *ngIf="a.severity === 'INFO' || !a.severity">Priorité basse</span>
          </div>

          <!-- Tabs fixes -->
          <div class="al-detail__tabs">
            <button [class.al-dtab--active]="detailTab === 'summary'" (click)="detailTab = 'summary'" type="button">Résumé</button>
            <button [class.al-dtab--active]="detailTab === 'data'"    (click)="detailTab = 'data'"    type="button">Données</button>
            <button [class.al-dtab--active]="detailTab === 'suivi'"   (click)="detailTab = 'suivi'"   type="button">Suivi</button>
            <button [class.al-dtab--active]="detailTab === 'pieces'"  (click)="detailTab = 'pieces'"  type="button">Pièces</button>
          </div>

          <!-- Contenu scrollable -->
          <div class="al-detail__body">

            <!-- RÉSUMÉ -->
            <ng-container *ngIf="detailTab === 'summary'">
              <div class="al-detail__section">
                <div class="al-detail__section-title">Informations générales</div>
                <div class="al-drow">
                  <span class="al-drow__k">Type d'alerte</span>
                  <span class="al-drow__v">{{ typeLabel(a.type) }}</span>
                </div>
                <div class="al-drow">
                  <span class="al-drow__k">Ouvrage</span>
                  <span class="al-drow__v">{{ pointName(a.pointId) }}</span>
                </div>
                <div class="al-drow">
                  <span class="al-drow__k">Type d'ouvrage</span>
                  <span class="al-drow__v">{{ pointTypeLabel(a.pointId) }}</span>
                </div>
                <div class="al-drow">
                  <span class="al-drow__k">Localisation</span>
                  <span class="al-drow__v">{{ pointTerritory(a.pointId) || '—' }}</span>
                </div>
                <div class="al-drow">
                  <span class="al-drow__k">Détectée le</span>
                  <span class="al-drow__v">{{ alertDateLabel(a.id) }}</span>
                </div>
                <div class="al-drow">
                  <span class="al-drow__k">Priorité</span>
                  <span class="al-drow__v">
                    <span class="al-prio-tag al-prio-tag--high" *ngIf="a.severity === 'CRIT'">Haute</span>
                    <span class="al-prio-tag al-prio-tag--med"  *ngIf="a.severity === 'WARN'">Moyenne</span>
                    <span class="al-prio-tag al-prio-tag--low"  *ngIf="a.severity === 'INFO' || !a.severity">Basse</span>
                  </span>
                </div>
                <div class="al-drow">
                  <span class="al-drow__k">Source</span>
                  <span class="al-drow__v">Capteur IoT</span>
                </div>
              </div>

              <!-- Impact estimé -->
              <div class="al-detail__section">
                <div class="al-detail__section-title">Impact estimé</div>
                <div class="al-drow">
                  <span class="al-drow__k">Zone affectée</span>
                  <span class="al-drow__v">{{ pointTerritory(a.pointId) || 'Zone locale' }}</span>
                </div>
                <div class="al-drow">
                  <span class="al-drow__k">Population</span>
                  <span class="al-drow__v">~1 200 – 3 000 personnes</span>
                </div>
                <div class="al-drow">
                  <span class="al-drow__k">Ouvrages liés</span>
                  <span class="al-drow__v">2 captages, 1 réservoir</span>
                </div>
              </div>

              <!-- Affectation -->
              <div class="al-detail__section">
                <div class="al-detail__section-title">Affectation</div>
                <div class="al-assignee-row">
                  <div class="al-avatar al-avatar--empty">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <div class="al-assignee-info">
                    <span class="al-assignee-name muted">Non assigné</span>
                    <span class="muted" style="font-size:.72rem">Équipe : —</span>
                  </div>
                  <button class="al-assign-btn" type="button" (click)="assignAlert(a.id)">Assigner</button>
                </div>
              </div>

              <!-- Recommandation -->
              <div class="al-detail__rec">
                <div class="al-detail__rec-head">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Recommandation
                </div>
                <p class="al-detail__rec-text">{{ recommendationFor(a.type) }}</p>
              </div>
            </ng-container>

            <!-- DONNÉES -->
            <ng-container *ngIf="detailTab === 'data'">
              <div class="al-detail__section">
                <div class="al-detail__section-title">Mesures associées</div>
                <div class="al-measure-grid">
                  <div class="al-measure-item">
                    <span class="al-measure-item__k">Valeur actuelle</span>
                    <span class="al-measure-item__v al-measure-item__v--crit" *ngIf="a.severity === 'CRIT'">{{ measureLabel(a.type, 'current') }}</span>
                    <span class="al-measure-item__v al-measure-item__v--warn" *ngIf="a.severity === 'WARN'">{{ measureLabel(a.type, 'current') }}</span>
                    <span class="al-measure-item__v" *ngIf="a.severity === 'INFO' || !a.severity">{{ measureLabel(a.type, 'current') }}</span>
                  </div>
                  <div class="al-measure-item">
                    <span class="al-measure-item__k">Seuil d'alerte</span>
                    <span class="al-measure-item__v">{{ measureLabel(a.type, 'warn') }}</span>
                  </div>
                  <div class="al-measure-item">
                    <span class="al-measure-item__k">Seuil critique</span>
                    <span class="al-measure-item__v">{{ measureLabel(a.type, 'crit') }}</span>
                  </div>
                  <div class="al-measure-item">
                    <span class="al-measure-item__k">Capteur associé</span>
                    <span class="al-measure-item__v">{{ sensorLabel(a.pointId) }}</span>
                  </div>
                  <div class="al-measure-item">
                    <span class="al-measure-item__k">Dernière mesure</span>
                    <span class="al-measure-item__v">{{ alertAge(a.id) }}</span>
                  </div>
                  <div class="al-measure-item">
                    <span class="al-measure-item__k">Qualité signal</span>
                    <span class="al-measure-item__v al-measure-item__v--ok">Bonne</span>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- SUIVI -->
            <ng-container *ngIf="detailTab === 'suivi'">
              <!-- Cycle de traitement -->
              <div class="al-detail__section">
                <div class="al-detail__section-title">Cycle de traitement</div>
                <div class="al-timeline">
                  <div class="al-timeline__step al-timeline__step--done">
                    <div class="al-timeline__dot"></div>
                    <div class="al-timeline__info">
                      <span class="al-timeline__label">Détectée</span>
                      <span class="al-timeline__age muted">{{ alertAge(a.id) }}</span>
                    </div>
                  </div>
                  <div class="al-timeline__connector"></div>
                  <div class="al-timeline__step"
                    [class.al-timeline__step--done]="a._apiStatus === 'ACK' || a._apiStatus === 'CLOSED'"
                    [class.al-timeline__step--pending]="a._apiStatus === 'ACTIVE'">
                    <div class="al-timeline__dot"></div>
                    <div class="al-timeline__info">
                      <span class="al-timeline__label">Assignée</span>
                      <span class="al-timeline__age muted" *ngIf="a._apiStatus === 'ACK' || a._apiStatus === 'CLOSED'">Il y a 2 h</span>
                    </div>
                  </div>
                  <div class="al-timeline__connector"></div>
                  <div class="al-timeline__step"
                    [class.al-timeline__step--done]="a._apiStatus === 'CLOSED'"
                    [class.al-timeline__step--active]="a._apiStatus === 'ACK'"
                    [class.al-timeline__step--pending]="a._apiStatus === 'ACTIVE'">
                    <div class="al-timeline__dot"></div>
                    <div class="al-timeline__info">
                      <span class="al-timeline__label">En cours</span>
                      <span class="al-timeline__age muted" *ngIf="a._apiStatus === 'ACK'">En cours…</span>
                      <span class="al-timeline__age muted" *ngIf="a._apiStatus === 'CLOSED'">Il y a 1 h</span>
                    </div>
                  </div>
                  <div class="al-timeline__connector"></div>
                  <div class="al-timeline__step"
                    [class.al-timeline__step--done]="a._apiStatus === 'CLOSED'"
                    [class.al-timeline__step--pending]="a._apiStatus !== 'CLOSED'">
                    <div class="al-timeline__dot"></div>
                    <div class="al-timeline__info">
                      <span class="al-timeline__label">Résolue</span>
                      <span class="al-timeline__age muted" *ngIf="a._apiStatus === 'CLOSED'">Il y a 45 min</span>
                    </div>
                  </div>
                  <div class="al-timeline__connector"></div>
                  <div class="al-timeline__step"
                    [class.al-timeline__step--done]="a._apiStatus === 'CLOSED'"
                    [class.al-timeline__step--pending]="a._apiStatus !== 'CLOSED'">
                    <div class="al-timeline__dot"></div>
                    <div class="al-timeline__info">
                      <span class="al-timeline__label">Clôturée</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Journal d'activité -->
              <div class="al-detail__section">
                <div class="al-detail__section-title">Journal d'activité</div>
                <div class="al-history">
                  <div class="al-history__item" *ngFor="let h of alertHistory(a)">
                    <div class="al-history__line"></div>
                    <div class="al-history__dot"
                      [class.al-history__dot--crit]="h.kind === 'open'"
                      [class.al-history__dot--progress]="h.kind === 'progress'"
                      [class.al-history__dot--ok]="h.kind === 'resolve'"></div>
                    <div class="al-history__content">
                      <span class="al-history__label">{{ h.label }}</span>
                      <span class="al-history__age muted">{{ h.age }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- PIÈCES -->
            <ng-container *ngIf="detailTab === 'pieces'">
              <div class="al-detail__section">
                <div class="al-detail__section-title">Pièces jointes</div>
                <div class="al-attachments-empty">
                  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  <p>Aucune pièce jointe</p>
                  <button class="al-btn al-btn--ghost" type="button" style="font-size:.78rem">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Ajouter un fichier
                  </button>
                </div>
              </div>
            </ng-container>

          </div>

          <!-- Actions rapides — fixes en bas -->
          <div class="al-detail__actions-footer">
            <button class="al-btn al-btn--primary al-btn--block" (click)="createTicket(a.id)" type="button">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              Créer une intervention
            </button>
            <div class="al-detail__footer-secondary">
              <button class="al-btn al-btn--ghost al-btn--sm" type="button">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
                Voir carte
              </button>
              <button class="al-btn al-btn--ghost al-btn--sm" (click)="markInProgress(a.id)" *ngIf="a._apiStatus === 'ACTIVE'" type="button">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                Marquer en cours
              </button>
              <button class="al-btn al-btn--ghost al-btn--sm" type="button">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Ajouter note
              </button>
            </div>
            <button class="al-detail__resolve-btn" (click)="ack(a.id)" *ngIf="a._apiStatus !== 'CLOSED'" type="button">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Résoudre l'alerte
            </button>
          </div>

      </div><!-- al-detail -->
    </ng-container>
</div><!-- al-detail-drawer -->

<!-- ══════════════════════════════════════════════════
     CREATE DRAWER — overlay + panel
══════════════════════════════════════════════════ -->
<div class="al-drawer-overlay" *ngIf="showCreateDrawer" (click)="showCreateDrawer = false"></div>

<div class="al-drawer" [class.al-drawer--open]="showCreateDrawer">
  <div class="al-drawer__head">
    <div>
      <h2 class="al-drawer__title">Création d'une alerte</h2>
      <p class="al-drawer__sub muted">Signaler manuellement une anomalie sur le réseau</p>
    </div>
    <button class="al-drawer__close" (click)="showCreateDrawer = false" type="button">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  <div class="al-drawer__body">

    <div class="al-drawer__section">
      <div class="al-drawer__section-title">Informations générales</div>

      <div class="al-form-group">
        <label class="al-form-label">Type d'alerte *</label>
        <select class="al-form-select" [(ngModel)]="createForm.type">
          <option value="">Sélectionner un type…</option>
          <optgroup label="Hydraulique">
            <option value="LEVEL_CRITICAL">Niveau critique</option>
            <option value="LEVEL_LOW">Niveau bas détecté</option>
            <option value="LEVEL_HIGH">Niveau anormalement élevé</option>
            <option value="PRESSURE_LOW">Pression très basse</option>
            <option value="PRESSURE_CRITICAL">Pression critique</option>
            <option value="FLOW_LOW">Débit insuffisant</option>
            <option value="FLOW_CRITICAL">Débit critique</option>
          </optgroup>
          <optgroup label="Qualité">
            <option value="QUALITY_ALERT">Alerte qualité</option>
            <option value="CONTAMINATION">Contamination détectée</option>
          </optgroup>
          <optgroup label="IoT / Capteur">
            <option value="SENSOR_OFFLINE">Capteur hors ligne</option>
            <option value="MAINTENANCE">Maintenance requise</option>
          </optgroup>
        </select>
      </div>

      <div class="al-form-group">
        <label class="al-form-label">Gravité *</label>
        <div class="al-radio-group">
          <label class="al-radio al-radio--crit" [class.al-radio--selected]="createForm.severity === 'CRIT'">
            <input type="radio" [(ngModel)]="createForm.severity" value="CRIT"> Critique
          </label>
          <label class="al-radio al-radio--warn" [class.al-radio--selected]="createForm.severity === 'WARN'">
            <input type="radio" [(ngModel)]="createForm.severity" value="WARN"> Avertissement
          </label>
          <label class="al-radio al-radio--info" [class.al-radio--selected]="createForm.severity === 'INFO'">
            <input type="radio" [(ngModel)]="createForm.severity" value="INFO"> Information
          </label>
        </div>
      </div>

      <div class="al-form-group">
        <label class="al-form-label">Source de l'alerte</label>
        <select class="al-form-select" [(ngModel)]="createForm.source">
          <option value="MANUAL">Saisie manuelle</option>
          <option value="SENSOR">Capteur IoT</option>
          <option value="FIELD">Agent terrain</option>
          <option value="CITIZEN">Citoyen</option>
          <option value="INSPECTION">Inspection</option>
          <option value="SYSTEM">Système automatique</option>
        </select>
      </div>

      <div class="al-form-group">
        <label class="al-form-label">Date et heure de détection</label>
        <input class="al-form-input" type="datetime-local" [(ngModel)]="createForm.detectedAt">
        <span class="al-form-hint">Par défaut : maintenant</span>
      </div>
    </div>

    <div class="al-drawer__section">
      <div class="al-drawer__section-title">Localisation</div>

      <div class="al-form-row">
        <div class="al-form-group">
          <label class="al-form-label">Département</label>
          <select class="al-form-select" [(ngModel)]="createForm.territory" (ngModelChange)="onCreateTerritoryChanged()">
            <option value="">Sélectionner…</option>
            <option *ngFor="let t of territories()" [value]="t">{{ t }}</option>
          </select>
        </div>
        <div class="al-form-group">
          <label class="al-form-label">Commune</label>
          <select class="al-form-select" [(ngModel)]="createForm.commune"
            [disabled]="!createForm.territory || createFormCommunes().length === 0">
            <option value="">
              {{ createForm.territory ? 'Sélectionner…' : 'Choisir d\'abord un département' }}
            </option>
            <option *ngFor="let c of createFormCommunes()" [value]="c">{{ c }}</option>
          </select>
        </div>
      </div>

      <div class="al-form-group">
        <label class="al-form-label">Ouvrage concerné</label>
        <select class="al-form-select" [(ngModel)]="createForm.pointId" (ngModelChange)="onCreatePointSelected()">
          <option value="">Sélectionner un ouvrage…</option>
          <option *ngFor="let p of createFormFilteredPoints()" [value]="p.id">{{ p.name }}</option>
        </select>
        <span class="al-form-hint" *ngIf="createForm.territory">
          {{ createFormFilteredPoints().length }} ouvrage(s) dans ce département
        </span>
      </div>
    </div>

    <div class="al-drawer__section">
      <div class="al-drawer__section-title">Données techniques</div>

      <div class="al-form-row">
        <div class="al-form-group">
          <label class="al-form-label">Valeur observée</label>
          <input class="al-form-input" [(ngModel)]="createForm.observedValue" placeholder="ex: 18 %">
        </div>
        <div class="al-form-group">
          <label class="al-form-label">Seuil de référence</label>
          <input class="al-form-input" [(ngModel)]="createForm.criticalThreshold" placeholder="ex: 20 %">
        </div>
      </div>

      <div class="al-form-group">
        <label class="al-form-label">Description de l'anomalie</label>
        <textarea class="al-form-textarea" [(ngModel)]="createForm.description" rows="3"
          placeholder="Décrire l'anomalie observée sur le terrain…"></textarea>
      </div>

      <div class="al-form-group">
        <label class="al-form-label">Recommandation proposée</label>
        <textarea class="al-form-textarea" [(ngModel)]="createForm.recommendation" rows="2"
          placeholder="Action recommandée pour résoudre l'anomalie…"></textarea>
      </div>
    </div>

    <div class="al-drawer__section">
      <div class="al-drawer__section-title">Assignation</div>

      <div class="al-form-group">
        <label class="al-form-label">Institution responsable *</label>
        <select class="al-form-select" [(ngModel)]="createForm.institution" (ngModelChange)="onAlertInstitutionChange()">
          <option value="">Non assignée</option>
          <option value="DINEPA">DINEPA (toutes directions)</option>
          <option value="DINEPA_OUEST">DINEPA — Direction Ouest</option>
          <option value="DINEPA_NORD">DINEPA — Direction Nord</option>
          <option value="DINEPA_SUD">DINEPA — Direction Sud</option>
          <option value="OREPA_OUEST">OREPA Ouest</option>
          <option value="OREPA_NORD">OREPA Nord</option>
          <option value="OREPA_SUD">OREPA Sud</option>
          <option value="MAIRIE">Mairie locale</option>
        </select>
      </div>

      <div class="al-form-group">
        <label class="al-form-label">
          Technicien assigné
          <span *ngIf="createForm.severity === 'CRIT'" style="color:#dc2626;margin-left:.2rem">* (obligatoire pour critique)</span>
        </label>
        <select class="al-form-select" [(ngModel)]="createForm.assignedTechnicianId"
          [disabled]="!createForm.institution">
          <option value="">{{ technicianPlaceholder }}</option>
          <option *ngFor="let t of availableTechs()" [value]="t.id">
            {{ t.name }} — {{ t.specialty }} — {{ t.zone }}
          </option>
        </select>
        <span class="al-form-hint" style="color:#f97316"
          *ngIf="createForm.institution && availableTechs().length === 0">
          Aucun technicien enregistré pour cette institution. Gérez les techniciens dans Gouvernance.
        </span>
      </div>

      <div class="al-form-group">
        <label class="al-form-label">Priorité</label>
        <select class="al-form-select" [(ngModel)]="createForm.priority">
          <option value="HIGH">Haute</option>
          <option value="MED">Moyenne</option>
          <option value="LOW">Basse</option>
        </select>
      </div>
    </div>

  </div>

  <div class="al-drawer__foot">
    <button class="al-btn al-btn--ghost" (click)="showCreateDrawer = false" type="button">Annuler</button>
    <button class="al-btn al-btn--primary" (click)="submitCreate()" type="button">Enregistrer l'alerte</button>
  </div>
</div>
  `,
  styles: []
})
export class AlertsPageComponent implements OnDestroy {
  allAlerts: any[] = [];
  loadingAlerts = false;

  search = '';
  filterSeverity = '';
  filterType = '';
  filterTerritory = '';
  filterPeriod = '7d';

  activeTab: AlertTab = 'all';
  selectedId?: number;
  isDetailPanelOpen = false;
  detailTab: DetailTab = 'summary';

  showCreateDrawer = false;
  showAdvancedFilters = false;

  createForm = {
    type: '', severity: 'CRIT', pointId: '', territory: '',
    commune: '', sectionCommunale: '', source: 'MANUAL',
    observedValue: '', criticalThreshold: '',
    description: '', recommendation: '',
    assignedTechnicianId: '', institution: '', priority: 'HIGH',
    detectedAt: '',
  };

  private refreshSub?: Subscription;

  readonly depts = HAITI_DEPARTMENTS;

  get communePlaceholder(): string {
    return this.createForm.territory ? 'Sélectionner…' : "Choisir d'abord un département";
  }

  constructor(
    private readonly api: BffApiService,
    private readonly toast: ToastService,
    private readonly i18n: I18nService,
    private readonly points: PointsService,
    private readonly measurementTypes: MeasurementTypesService,
    private readonly refresh: RefreshService,
    private readonly geo: HaitiGeoService,
    readonly govStore: GovernanceStore,
    readonly infraStore: InfrastructureStore,
  ) {
    this.points.ensureLoaded().subscribe();
    this.measurementTypes.ensureLoaded().subscribe();
    this.reload();
    this.refreshSub = this.refresh.refresh$.subscribe((e) => this.reload(e.reason === 'manual', e.reason === 'auto'));
  }

  reload(showErrorToast = false, silent = false) {
    if (!silent) this.loadingAlerts = true;
    forkJoin({
      active: this.api.alerts('ACTIVE').pipe(catchError(() => of([]))),
      ack:    this.api.alerts('ACK').pipe(catchError(() => of([]))),
      closed: this.api.alerts('CLOSED').pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ active, ack, closed }) => {
        const prevSelectedId = this.selectedId;
        this.allAlerts = [
          ...(active as any[] || []).map((a: any) => ({ ...a, _apiStatus: 'ACTIVE' })),
          ...(ack    as any[] || []).map((a: any) => ({ ...a, _apiStatus: 'ACK'    })),
          ...(closed as any[] || []).map((a: any) => ({ ...a, _apiStatus: 'CLOSED' })),
        ];
        this.loadingAlerts = false;
        if (prevSelectedId && !this.allAlerts.find((a) => a.id === prevSelectedId)) {
          this.closeDetail();
        }
      },
      error: () => {
        this.loadingAlerts = false;
        if (showErrorToast) this.toast.push('error', this.i18n.t('toast.failed'));
      }
    });
  }

  setTab(tab: AlertTab) {
    this.activeTab = tab;
    this.closeDetail();
  }

  selectAlert(id: number) {
    this.selectedId = id;
    this.isDetailPanelOpen = true;
    this.detailTab = 'summary';
  }

  closeDetail() {
    this.selectedId = undefined;
    this.isDetailPanelOpen = false;
  }

  selectedAlert(): any {
    if (!this.isDetailPanelOpen || !this.selectedId) return null;
    return this.allAlerts.find((a) => a.id === this.selectedId) ?? null;
  }

  filteredAlerts(): any[] {
    let list = this.allAlerts;

    switch (this.activeTab) {
      case 'open':     list = list.filter((a) => a._apiStatus === 'ACTIVE'); break;
      case 'progress': list = list.filter((a) => a._apiStatus === 'ACK'); break;
      case 'critical': list = list.filter((a) => a.severity === 'CRIT' && a._apiStatus === 'ACTIVE'); break;
      case 'resolved': list = list.filter((a) => a._apiStatus === 'CLOSED'); break;
      case 'ignored':  list = []; break;
    }

    if (this.search.trim()) {
      const q = this.search.toLowerCase();
      list = list.filter((a) =>
        this.pointName(a.pointId).toLowerCase().includes(q) ||
        this.pointTerritory(a.pointId).toLowerCase().includes(q) ||
        this.typeLabel(a.type).toLowerCase().includes(q) ||
        (a.message ?? '').toLowerCase().includes(q)
      );
    }

    if (this.filterSeverity) list = list.filter((a) => a.severity === this.filterSeverity);
    if (this.filterType) list = list.filter((a) => a.type === this.filterType);
    if (this.filterTerritory) {
      list = list.filter((a) => this.pointTerritory(a.pointId) === this.filterTerritory);
    }

    return list.sort((a, b) => {
      const rank = (s: string) => s === 'CRIT' ? 3 : s === 'WARN' ? 2 : 1;
      const rd = rank(b.severity) - rank(a.severity);
      return rd !== 0 ? rd : (b.id ?? 0) - (a.id ?? 0);
    });
  }

  countFor(tab: string): number {
    const list = this.allAlerts;
    switch (tab) {
      case 'all':      return list.length;
      case 'open':     return list.filter((a) => a._apiStatus === 'ACTIVE').length;
      case 'progress': return list.filter((a) => a._apiStatus === 'ACK').length;
      case 'critical': return list.filter((a) => a.severity === 'CRIT' && a._apiStatus === 'ACTIVE').length;
      case 'resolved': return list.filter((a) => a._apiStatus === 'CLOSED').length;
      default: return 0;
    }
  }

  lastUpdateTime(): string {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  kpiWarnCount(): number {
    return this.allAlerts.filter((a) => a.severity === 'WARN').length;
  }

  kpiOfflineCount(): number {
    return this.allAlerts.filter((a) => a.type === 'SENSOR_OFFLINE').length;
  }

  pointName(pointId: string): string {
    const p = this.points.all().find((pt) => pt.id === pointId);
    return p?.name ?? this.points.label(pointId);
  }

  pointTerritory(pointId: string): string {
    const p = this.points.all().find((pt) => pt.id === pointId);
    return (p?.territory ?? '').trim();
  }

  pointCommune(pointId: string): string {
    return this.pointTerritory(pointId);
  }

  territories(): string[] {
    const unique = new Set(
      this.points.all().map((p) => (p.territory ?? '').trim()).filter(Boolean)
    );
    return [...unique].sort();
  }

  allPoints(): Array<{ id: string; name: string }> {
    return this.points.all().filter((p) => p.active).map((p) => ({ id: p.id, name: p.name }));
  }

  uniqueTypes(): string[] {
    return [...new Set(this.allAlerts.map((a) => a.type).filter(Boolean))].sort();
  }

  typeLabel(type: string): string {
    const map: Record<string, string> = {
      LEVEL_LOW:         'Niveau bas détecté',
      LEVEL_CRITICAL:    'Niveau critique détecté',
      LEVEL_HIGH:        'Niveau anormalement élevé',
      PRESSURE_LOW:      'Pression très basse',
      PRESSURE_CRITICAL: 'Pression critique',
      PRESSURE_HIGH:     'Surpression détectée',
      FLOW_LOW:          'Débit insuffisant',
      FLOW_CRITICAL:     'Débit critique',
      SENSOR_OFFLINE:    'Capteur hors ligne',
      QUALITY_ALERT:     'Alerte qualité',
      CONTAMINATION:     'Contamination détectée',
      MAINTENANCE:       'Maintenance requise',
    };
    return map[type] ?? type.replace(/_/g, ' ');
  }

  alertAge(alertId: number): string {
    const buckets = [3, 8, 12, 25, 38, 55, 72, 110, 180, 360, 720, 1440, 2880];
    const min = buckets[alertId % buckets.length];
    if (min < 60) return `Il y a ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `Il y a ${h} h`;
    return `Il y a ${Math.floor(h / 24)} j`;
  }

  alertDateLabel(alertId: number): string {
    const buckets = [3, 8, 12, 25, 38, 55, 72, 110, 180, 360];
    const min = buckets[alertId % buckets.length];
    const d = new Date(Date.now() - min * 60_000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} à ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  recommendationFor(type: string): string {
    const map: Record<string, string> = {
      LEVEL_CRITICAL:    'Vérifier l\'alimentation du réservoir et inspecter une éventuelle fuite ou rupture sur la conduite principale. Assurer la distribution alternative si nécessaire.',
      LEVEL_LOW:         'Surveiller l\'évolution du niveau. Identifier la cause de la baisse et alerter l\'équipe terrain pour inspection sur site.',
      PRESSURE_LOW:      'Vérifier la pompe et l\'état de la conduite principale. Contrôler les vannes en amont.',
      PRESSURE_CRITICAL: 'Intervention urgente requise. Vérifier la pompe et inspecter la conduite principale pour rupture ou obstruction.',
      FLOW_LOW:          'Contrôler le débit en amont et vérifier l\'état des vannes et des conduites. Inspecter les pompes.',
      FLOW_CRITICAL:     'Arrêt probable de la distribution. Vérifier la source d\'alimentation, les pompes et les vannes principales.',
      SENSOR_OFFLINE:    'Vérifier la connexion du capteur et l\'alimentation électrique. Envoyer un technicien pour inspection physique.',
      QUALITY_ALERT:     'Effectuer une analyse d\'eau sur site. Suspendre la distribution si une contamination est confirmée.',
      CONTAMINATION:     'Suspendre immédiatement la distribution. Alerter les autorités sanitaires et effectuer une analyse complète.',
      MAINTENANCE:       'Planifier une intervention de maintenance préventive dans les 48 heures.',
    };
    return map[type] ?? 'Inspecter l\'ouvrage concerné et contacter l\'équipe terrain pour évaluation sur site.';
  }

  measureLabel(type: string, kind: 'current' | 'warn' | 'crit'): string {
    const tpl: Record<string, [string, string, string]> = {
      LEVEL_CRITICAL:    ['18 %',       '30 %',       '20 %'      ],
      LEVEL_LOW:         ['28 %',       '35 %',       '20 %'      ],
      LEVEL_HIGH:        ['92 %',       '85 %',       '95 %'      ],
      LEVEL:             ['18 %',       '30 %',       '20 %'      ],
      PRESSURE_LOW:      ['0,45 bar',   '0,80 bar',   '0,50 bar'  ],
      PRESSURE_CRITICAL: ['0,20 bar',   '0,80 bar',   '0,30 bar'  ],
      PRESSURE:          ['0,45 bar',   '0,80 bar',   '0,30 bar'  ],
      FLOW_LOW:          ['12 m³/h',    '18 m³/h',    '10 m³/h'   ],
      FLOW_CRITICAL:     ['3 m³/h',     '15 m³/h',    '5 m³/h'    ],
      FLOW:              ['12 m³/h',    '18 m³/h',    '10 m³/h'   ],
      QUALITY_ALERT:     ['4,8 NTU',    '2,0 NTU',    '5,0 NTU'   ],
      CONTAMINATION:     ['Détectée',   '—',           'Présence'  ],
    };
    const t = tpl[type];
    if (!t) return '—';
    return kind === 'current' ? t[0] : kind === 'warn' ? t[1] : t[2];
  }

  pointTypeLabel(pointId: string): string {
    const p = this.points.all().find((pt) => pt.id === pointId);
    const type = (p as any)?.type ?? '';
    const map: Record<string, string> = {
      TANK:        'Réservoir',
      SCHOOL:      'Point d\'eau École',
      'KIOSK-NIP': 'Kiosque Nippes',
      KIOSK:       'Kiosque',
      BOREHOLE:    'Forage',
      SPRING:      'Source',
      PUMP:        'Station de pompage',
      TREATMENT:   'Station de traitement',
    };
    return map[type] || type || '—';
  }

  sensorLabel(pointId: string): string {
    return `Capteur ${pointId.replace('POINT-', 'C-')}`;
  }

  alertHistory(alert: any): Array<{ kind: string; label: string; age: string }> {
    const history = [
      { kind: 'open',     label: 'Alerte détectée automatiquement',  age: this.alertAge(alert.id) },
    ];
    if (alert._apiStatus === 'ACK' || alert._apiStatus === 'CLOSED') {
      history.push({ kind: 'progress', label: 'Alerte prise en charge',      age: 'Il y a 2 h' });
    }
    if (alert._apiStatus === 'CLOSED') {
      history.push({ kind: 'resolve',  label: 'Alerte résolue et clôturée',  age: 'Il y a 45 min' });
    }
    return history;
  }

  ack(id: number) {
    this.api.ackAlert(id).subscribe({
      next: () => {
        this.toast.push('success', 'Alerte résolue avec succès');
        this.reload();
      },
      error: () => this.toast.push('error', this.i18n.t('toast.failed'))
    });
  }

  markInProgress(id: number) {
    this.api.ackAlert(id).subscribe({
      next: () => {
        this.toast.push('success', 'Alerte marquée en cours');
        this.reload();
      },
      error: () => this.toast.push('error', this.i18n.t('toast.failed'))
    });
  }

  createTicket(alertId: number) {
    const tech = this.govStore.techniciens.find(t => t.id === this.createForm.assignedTechnicianId);
    this.api.createTicket(alertId, tech?.name || 'tech').subscribe({
      next: () => {
        this.toast.push('success', this.i18n.t('toast.ticketCreated'));
        this.reload();
      },
      error: () => this.toast.push('error', this.i18n.t('toast.failed'))
    });
  }

  assignAlert(_id: number) {
    this.toast.push('info', 'Fonctionnalité d\'assignation disponible prochainement');
  }

  createFormCommunes(): string[] {
    return this.geo.communesForDept(this.createForm.territory);
  }

  createFormFilteredPoints(): Array<{ id: string; name: string }> {
    let pts = this.points.all().filter((p) => p.active);
    if (this.createForm.territory) {
      pts = pts.filter((p) => (p.territory ?? '').trim() === this.createForm.territory);
    }
    return pts.map((p) => ({ id: p.id, name: p.name }));
  }

  onCreatePointSelected(): void {
    if (!this.createForm.pointId) return;
    const pt = this.points.all().find((p) => p.id === this.createForm.pointId);
    if (!pt) return;
    const territory = (pt.territory ?? '').trim();
    if (territory && !this.createForm.territory) {
      this.createForm.territory = territory;
      this.createForm.commune = '';
    }
  }

  availableTechs(): Technicien[] {
    return this.govStore.techniciensForInstitution(this.createForm.institution);
  }

  get technicianPlaceholder(): string {
    return this.createForm.institution
      ? 'Sélectionner un technicien...'
      : "Choisir d'abord une institution";
  }

  onAlertInstitutionChange(): void {
    this.createForm.assignedTechnicianId = '';
  }

  onCreateTerritoryChanged(): void {
    this.createForm.commune = '';
    this.createForm.sectionCommunale = '';
    if (this.createForm.pointId) {
      const pt = this.points.all().find((p) => p.id === this.createForm.pointId);
      const ptTerritory = (pt?.territory ?? '').trim();
      if (ptTerritory !== this.createForm.territory) {
        this.createForm.pointId = '';
      }
    }
  }

  submitCreate() {
    if (!this.createForm.type || !this.createForm.severity) {
      this.toast.push('error', 'Veuillez remplir les champs obligatoires (type et gravité)');
      return;
    }
    if (this.createForm.severity === 'CRIT' && !this.createForm.assignedTechnicianId) {
      this.toast.push('error', 'Une alerte critique doit être assignée à un technicien enregistré');
      return;
    }

    const tech = this.govStore.techniciens.find(t => t.id === this.createForm.assignedTechnicianId);
    const payload: Record<string, unknown> = {
      type:                 this.createForm.type,
      severity:             this.createForm.severity,
      pointId:              this.createForm.pointId   || null,
      territory:            this.createForm.territory  || null,
      commune:              this.createForm.commune    || null,
      sectionCommunale:     this.createForm.sectionCommunale || null,
      source:               this.createForm.source,
      observedValue:        this.createForm.observedValue    || null,
      criticalThreshold:    this.createForm.criticalThreshold || null,
      description:          this.createForm.description  || null,
      recommendation:       this.createForm.recommendation || null,
      assignedTechnicianId: this.createForm.assignedTechnicianId || null,
      assignee:             tech?.name || null,
      institution:          this.createForm.institution || null,
      priority:             this.createForm.priority,
      detectedAt:           this.createForm.detectedAt  || new Date().toISOString(),
    };

    this.api.createAlert(payload).pipe(
      catchError(() => of({ ...payload, id: Date.now(), _apiStatus: 'ACTIVE' }))
    ).subscribe({
      next: (created: any) => {
        const newAlert = { ...created, _apiStatus: created._apiStatus ?? 'ACTIVE' };
        this.allAlerts = [newAlert, ...this.allAlerts];
        this.showCreateDrawer = false;
        this.createForm = {
          type: '', severity: 'CRIT', pointId: '', territory: '',
          commune: '', sectionCommunale: '', source: 'MANUAL',
          observedValue: '', criticalThreshold: '',
          description: '', recommendation: '',
          assignedTechnicianId: '', institution: '', priority: 'HIGH',
          detectedAt: '',
        };

        const label = this.typeLabel(newAlert.type);
        const assigneeMsg = newAlert.assignee
          ? `Assignée à ${newAlert.assignee}.`
          : 'Non assignée.';
        this.toast.push('success', `Alerte créée — ${label}. ${assigneeMsg}`);

        const visible = this.filteredAlerts().some((a) => a.id === newAlert.id);
        if (!visible) {
          this.toast.push('info', 'Alerte créée mais masquée par les filtres actifs.');
        } else {
          this.selectAlert(newAlert.id);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }
}
