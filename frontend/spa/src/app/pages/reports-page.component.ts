import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../ui/toast.service';

type ReportStatus = 'brouillon' | 'genere' | 'valide' | 'transmis' | 'archive' | 'echec';
type ReportType = 'service' | 'alertes' | 'interventions' | 'infrastructures' | 'iot' | 'qualite' | 'traceabilite' | 'executif';

interface ReportVersion { version: string; createdBy: string; createdAt: string; changes: string; }

interface ReportEntry {
  id: string; title: string; subtitle: string; type: ReportType; module: string;
  periodLabel: string; zone: string; author: string; status: ReportStatus;
  format: 'pdf' | 'docx' | 'xlsx'; createdAt: string; institution: string;
  fileSize: string; version: string; sections: string[]; versions: ReportVersion[];
}

const REPORTS: ReportEntry[] = [
  {
    id: 'rpt-001', title: 'Rapport de service Léogâne - Avril 2026',
    subtitle: 'Desserte, continuité et incidents', type: 'service', module: 'Service',
    periodLabel: '01/04/2026 – 29/04/2026', zone: 'Commune Léogâne',
    author: 'Admin', status: 'valide', format: 'pdf',
    createdAt: '29/04/2026 09:35', institution: 'DINEPA Ouest', fileSize: '2.4 Mo', version: '1.0',
    sections: ["Résumé exécutif", "Carte du service", "Zones desservies", "Points d'eau", "Coupures et incidents", "Interventions réalisées", "Données IoT utilisées", "Annexes et photos"],
    versions: [{ version: 'v1.0', createdBy: 'Admin', createdAt: '29/04/2026 09:35', changes: 'Version initiale validée' }],
  },
  {
    id: 'rpt-002', title: 'Incidents critiques - 7 derniers jours',
    subtitle: 'Alertes et incidents', type: 'alertes', module: 'Alertes',
    periodLabel: '22/04/2026 – 29/04/2026', zone: 'Département Ouest',
    author: 'DINEPA Ouest', status: 'genere', format: 'pdf',
    createdAt: '29/04/2026 08:20', institution: 'DINEPA', fileSize: '1.1 Mo', version: '1.0',
    sections: ["Résumé des alertes", "Incidents critiques", "Zones affectées", "Interventions déclenchées", "Statuts de résolution"],
    versions: [{ version: 'v1.0', createdBy: 'Système', createdAt: '29/04/2026 08:20', changes: 'Génération automatique' }],
  },
  {
    id: 'rpt-003', title: 'Interventions réalisées Avril 2026',
    subtitle: 'Travaux et visites terrain', type: 'interventions', module: 'Interventions',
    periodLabel: '01/04/2026 – 29/04/2026', zone: 'Section Dessources',
    author: 'Marc Étienne', status: 'valide', format: 'pdf',
    createdAt: '28/04/2026 16:40', institution: 'DINEPA Ouest', fileSize: '3.2 Mo', version: '1.0',
    sections: ["Résumé des interventions", "Tâches réalisées", "Mesures relevées", "Anomalies constatées", "Photos terrain", "Résultats et recommandations"],
    versions: [{ version: 'v1.0', createdBy: 'Marc Étienne', createdAt: '28/04/2026 16:40', changes: 'Validé par superviseur' }],
  },
  {
    id: 'rpt-004', title: 'État des infrastructures Ouest',
    subtitle: 'Réservoirs, pompes, captages...', type: 'infrastructures', module: 'Infrastructures',
    periodLabel: '01/04/2026 – 29/04/2026', zone: 'Département Ouest',
    author: 'Admin', status: 'brouillon', format: 'docx',
    createdAt: '28/04/2026 11:15', institution: 'DINEPA', fileSize: '—', version: '0.1',
    sections: ["Identification des ouvrages", "État de fonctionnement", "Alertes associées", "Maintenance récente", "Recommandations"],
    versions: [{ version: 'v0.1', createdBy: 'Admin', createdAt: '28/04/2026 11:15', changes: 'Brouillon en cours' }],
  },
  {
    id: 'rpt-005', title: 'Rapport IoT - Capteurs',
    subtitle: 'Données et alertes IoT', type: 'iot', module: 'IoT',
    periodLabel: '22/04/2026 – 29/04/2026', zone: 'National',
    author: 'Système', status: 'valide', format: 'pdf',
    createdAt: '27/04/2026 17:05', institution: 'DINEPA', fileSize: '0.8 Mo', version: '1.0',
    sections: ["Liste des capteurs", "Dernières transmissions", "Capteurs hors ligne", "Batterie faible", "Mesures hors seuil", "Recommandations techniques"],
    versions: [{ version: 'v1.0', createdBy: 'Système', createdAt: '27/04/2026 17:05', changes: 'Génération automatique validée' }],
  },
  {
    id: 'rpt-006', title: "Qualité de l'eau - Avril",
    subtitle: 'Analyses et conformité', type: 'qualite', module: 'Qualité',
    periodLabel: '02/04/2026 – 29/04/2026', zone: 'Toutes zones',
    author: 'Lab. DINEPA', status: 'valide', format: 'pdf',
    createdAt: '27/04/2026 14:10', institution: 'DINEPA', fileSize: '1.6 Mo', version: '1.0',
    sections: ["Résultats pH", "Turbidité", "Chlore résiduel", "Conformité réglementaire", "Points hors normes", "Recommandations"],
    versions: [{ version: 'v1.0', createdBy: 'Lab. DINEPA', createdAt: '27/04/2026 14:10', changes: 'Validé par laboratoire' }],
  },
  {
    id: 'rpt-007', title: 'Audit système - Avril',
    subtitle: 'Journal des actions et modifications', type: 'traceabilite', module: 'Traçabilité',
    periodLabel: '01/04/2026 – 29/04/2026', zone: 'National',
    author: 'Admin', status: 'valide', format: 'pdf',
    createdAt: '26/04/2026 20:30', institution: 'DINEPA', fileSize: '2.1 Mo', version: '1.0',
    sections: ["Période d'audit", "Utilisateurs actifs", "Actions sensibles", "Modifications critiques", "Journal détaillé", "Observations d'audit"],
    versions: [{ version: 'v1.0', createdBy: 'Admin', createdAt: '26/04/2026 20:30', changes: 'Audit mensuel validé' }],
  },
  {
    id: 'rpt-008', title: 'Résumé exécutif - Avril 2026',
    subtitle: 'Synthèse pour les décideurs', type: 'executif', module: 'Exécutif',
    periodLabel: '01/04/2026 – 29/04/2026', zone: 'National',
    author: 'Admin', status: 'transmis', format: 'pdf',
    createdAt: '26/04/2026 15:45', institution: 'DINEPA', fileSize: '0.5 Mo', version: '1.0',
    sections: ["Résumé exécutif", "Points clés du mois", "Indicateurs de performance", "Incidents critiques", "Recommandations stratégiques"],
    versions: [{ version: 'v1.0', createdBy: 'Admin', createdAt: '26/04/2026 15:45', changes: 'Transmis aux décideurs' }],
  },
];

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="rpt-shell">

  <!-- ══ HEADER ══════════════════════════════════════════════ -->
  <div class="rpt-header">
    <div class="rpt-header__left">
      <h1 class="rpt-header__title">Rapports</h1>
      <p class="rpt-header__sub">Générer, consulter et exporter les rapports techniques et opérationnels du réseau AEP.</p>
    </div>
    <div class="rpt-header__actions">
      <button class="rpt-btn rpt-btn--primary" type="button" (click)="showCreateDrawer = true">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Créer un rapport
      </button>
      <button class="rpt-btn rpt-btn--outline" type="button" (click)="showTemplatesDrawer = true">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        Modèles de rapport
      </button>
      <button class="rpt-btn rpt-btn--ghost" type="button" (click)="notifyExportList()">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Exporter la liste
      </button>
    </div>
  </div>

  <!-- ══ KPI BAR ══════════════════════════════════════════════ -->
  <div class="rpt-kpi-bar">
    <div class="rpt-kpi">
      <div class="rpt-kpi__icon rpt-kpi__icon--blue">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      </div>
      <div class="rpt-kpi__body"><span class="rpt-kpi__val">128</span><span class="rpt-kpi__lbl">Total des rapports</span></div>
    </div>
    <div class="rpt-kpi-sep"></div>
    <div class="rpt-kpi">
      <div class="rpt-kpi__icon rpt-kpi__icon--teal">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <div class="rpt-kpi__body"><span class="rpt-kpi__val rpt-kpi__val--teal">12</span><span class="rpt-kpi__lbl">Générés ce mois-ci</span></div>
    </div>
    <div class="rpt-kpi-sep"></div>
    <div class="rpt-kpi">
      <div class="rpt-kpi__icon rpt-kpi__icon--orange">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <div class="rpt-kpi__body"><span class="rpt-kpi__val rpt-kpi__val--orange">4</span><span class="rpt-kpi__lbl">En attente de validation</span></div>
    </div>
    <div class="rpt-kpi-sep"></div>
    <div class="rpt-kpi">
      <div class="rpt-kpi__icon rpt-kpi__icon--purple">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </div>
      <div class="rpt-kpi__body"><span class="rpt-kpi__val rpt-kpi__val--purple">8</span><span class="rpt-kpi__lbl">Transmis</span></div>
    </div>
    <div class="rpt-kpi-sep"></div>
    <div class="rpt-kpi">
      <div class="rpt-kpi__icon rpt-kpi__icon--green">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      </div>
      <div class="rpt-kpi__body"><span class="rpt-kpi__val rpt-kpi__val--green">96</span><span class="rpt-kpi__lbl">Validés</span></div>
    </div>
    <div class="rpt-kpi-sep"></div>
    <div class="rpt-kpi">
      <div class="rpt-kpi__icon rpt-kpi__icon--gray">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      </div>
      <div class="rpt-kpi__body"><span class="rpt-kpi__val">8</span><span class="rpt-kpi__lbl">Archivé(s)</span></div>
    </div>
  </div>

  <!-- ══ BODY ══════════════════════════════════════════════════ -->
  <div class="rpt-body">

    <!-- ── FILTERS ──────────────────────────────────────────── -->
    <div class="rpt-filters">
      <div class="rpt-filters__head">
        <span class="rpt-filters__title">Filtres</span>
        <button class="rpt-filters__reset" type="button" (click)="resetFilters()">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.32"/></svg>
          Réinitialiser
        </button>
      </div>

      <div class="rpt-fg">
        <label class="rpt-fl">Période</label>
        <div class="rpt-period-box">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <input type="date" class="rpt-date-in" [(ngModel)]="filterDateFrom">
          <span class="rpt-period-sep">—</span>
          <input type="date" class="rpt-date-in" [(ngModel)]="filterDateTo">
        </div>
      </div>
      <div class="rpt-fg">
        <label class="rpt-fl">Département</label>
        <select class="rpt-fs" [(ngModel)]="filterDept">
          <option value="">Tous les départements</option>
          <option value="Ouest">Ouest</option>
          <option value="Nord">Nord</option>
          <option value="Sud">Sud</option>
          <option value="Artibonite">Artibonite</option>
          <option value="Centre">Centre</option>
        </select>
      </div>
      <div class="rpt-fg">
        <label class="rpt-fl">Commune</label>
        <select class="rpt-fs" [(ngModel)]="filterCommune">
          <option value="">Toutes les communes</option>
          <option value="Léogâne">Léogâne</option>
          <option value="Petit-Goâve">Petit-Goâve</option>
          <option value="Grand-Goâve">Grand-Goâve</option>
          <option value="Jacmel">Jacmel</option>
        </select>
      </div>
      <div class="rpt-fg">
        <label class="rpt-fl">Section communale</label>
        <select class="rpt-fs" [(ngModel)]="filterSection">
          <option value="">Toutes les sections</option>
          <option value="Dessources">Dessources</option>
          <option value="Centre">Centre</option>
          <option value="Nan Palmiste">Nan Palmiste</option>
        </select>
      </div>
      <div class="rpt-fg">
        <label class="rpt-fl">Module</label>
        <select class="rpt-fs" [(ngModel)]="filterModule">
          <option value="">Tous les modules</option>
          <option value="Service">Service</option>
          <option value="Ressources">Ressources</option>
          <option value="Infrastructures">Infrastructures</option>
          <option value="Alertes">Alertes</option>
          <option value="Interventions">Interventions</option>
          <option value="IoT">IoT</option>
          <option value="Qualité">Qualité</option>
          <option value="Traçabilité">Traçabilité</option>
        </select>
      </div>
      <div class="rpt-fg">
        <label class="rpt-fl">Type de rapport</label>
        <select class="rpt-fs" [(ngModel)]="filterType">
          <option value="">Tous les types</option>
          <option value="service">Service</option>
          <option value="alertes">Alertes</option>
          <option value="interventions">Interventions</option>
          <option value="infrastructures">Infrastructures</option>
          <option value="iot">IoT</option>
          <option value="qualite">Qualité</option>
          <option value="traceabilite">Traçabilité</option>
          <option value="executif">Exécutif</option>
        </select>
      </div>
      <div class="rpt-fg">
        <label class="rpt-fl">Statut</label>
        <select class="rpt-fs" [(ngModel)]="filterStatus">
          <option value="">Tous les statuts</option>
          <option value="brouillon">Brouillon</option>
          <option value="genere">Généré</option>
          <option value="valide">Validé</option>
          <option value="transmis">Transmis</option>
          <option value="archive">Archivé</option>
          <option value="echec">Échec</option>
        </select>
      </div>
      <div class="rpt-fg">
        <label class="rpt-fl">Auteur</label>
        <select class="rpt-fs" [(ngModel)]="filterAuthor">
          <option value="">Tous les auteurs</option>
          <option value="Admin">Admin</option>
          <option value="DINEPA Ouest">DINEPA Ouest</option>
          <option value="Marc Étienne">Marc Étienne</option>
          <option value="Lab. DINEPA">Lab. DINEPA</option>
          <option value="Système">Système</option>
        </select>
      </div>
      <div class="rpt-fg">
        <label class="rpt-fl">Institution</label>
        <select class="rpt-fs" [(ngModel)]="filterInstitution">
          <option value="">Toutes les institutions</option>
          <option value="DINEPA">DINEPA</option>
          <option value="DINEPA Ouest">DINEPA Ouest</option>
          <option value="OREPA Ouest">OREPA Ouest</option>
        </select>
      </div>
      <div class="rpt-fg">
        <label class="rpt-fl">Format</label>
        <select class="rpt-fs" [(ngModel)]="filterFormat">
          <option value="">Tous les formats</option>
          <option value="pdf">PDF</option>
          <option value="docx">Word (DOCX)</option>
          <option value="xlsx">Excel (XLSX)</option>
        </select>
      </div>

      <button class="rpt-adv-btn" type="button">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        Filtres avancés
      </button>
    </div>

    <!-- ── CENTER ──────────────────────────────────────────── -->
    <div class="rpt-main">

      <!-- Search bar -->
      <div class="rpt-search-bar">
        <div class="rpt-search">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="rpt-search__icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="rpt-search__input" [(ngModel)]="searchQuery" placeholder="Rechercher un rapport...">
        </div>
        <span class="rpt-total muted">{{ filteredReports().length }} rapport(s)</span>
      </div>

      <!-- Table -->
      <div class="rpt-table-scroll">
        <table class="rpt-table">
          <thead>
            <tr>
              <th>RAPPORT</th>
              <th>TYPE</th>
              <th>PÉRIODE</th>
              <th>ZONE / PORTÉE</th>
              <th>AUTEUR</th>
              <th>STATUT</th>
              <th>FORMAT</th>
              <th>CRÉÉ LE</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of pagedReports()"
              class="rpt-row"
              [class.rpt-row--selected]="selectedId === r.id"
              (click)="selectReport(r.id)">

              <!-- Rapport (icon + title + subtitle) -->
              <td class="rpt-cell-name">
                <div class="rpt-type-icon" [style.background]="typeBg(r.type)" [style.color]="typeColor(r.type)">
                  <ng-container [ngSwitch]="r.type">
                    <svg *ngSwitchCase="'alertes'" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                    <svg *ngSwitchCase="'iot'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M1.42 9a16 16 0 0 1 21.16 0M5 12.55a11 11 0 0 1 14.08 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg>
                    <svg *ngSwitchCase="'interventions'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    <svg *ngSwitchCase="'qualite'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                    <svg *ngSwitchCase="'traceabilite'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <svg *ngSwitchDefault viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </ng-container>
                </div>
                <div class="rpt-name-block">
                  <span class="rpt-name">{{ r.title }}</span>
                  <span class="rpt-sub muted">{{ r.subtitle }}</span>
                </div>
              </td>

              <!-- Type -->
              <td><span class="rpt-type-badge rpt-type-badge--{{ r.type }}">{{ typeLabelShort(r.type) }}</span></td>

              <!-- Période -->
              <td class="rpt-cell-period muted" style="font-size:.74rem;white-space:nowrap">{{ r.periodLabel }}</td>

              <!-- Zone -->
              <td class="muted" style="font-size:.78rem">{{ r.zone }}</td>

              <!-- Auteur -->
              <td style="font-size:.78rem">{{ r.author }}</td>

              <!-- Statut -->
              <td><span class="rpt-status rpt-status--{{ r.status }}">{{ statusLabel(r.status) }}</span></td>

              <!-- Format -->
              <td>
                <span class="rpt-fmt rpt-fmt--{{ r.format }}">{{ r.format.toUpperCase() }}</span>
              </td>

              <!-- Créé le -->
              <td class="muted" style="font-size:.74rem;white-space:nowrap">{{ r.createdAt }}</td>

              <!-- Actions -->
              <td class="rpt-cell-actions" (click)="$event.stopPropagation()">
                <button class="rpt-row-btn" title="Voir" type="button" (click)="selectReport(r.id)">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="rpt-row-btn" title="Plus" type="button" (click)="notifyRowAction()">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="rpt-pagination">
        <span class="muted" style="font-size:.77rem">
          Affichage de 1 à {{ pagedReports().length }} sur {{ filteredReports().length }} rapports
        </span>
        <div class="rpt-pages">
          <button class="rpt-page-btn" [disabled]="currentPage === 1" (click)="currentPage = currentPage - 1" type="button">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button class="rpt-page-num" [class.rpt-page-num--active]="currentPage === 1" (click)="currentPage = 1" type="button">1</button>
          <button class="rpt-page-num" *ngIf="totalPages() >= 2" [class.rpt-page-num--active]="currentPage === 2" (click)="currentPage = 2" type="button">2</button>
          <button class="rpt-page-num" *ngIf="totalPages() >= 3" [class.rpt-page-num--active]="currentPage === 3" (click)="currentPage = 3" type="button">3</button>
          <span *ngIf="totalPages() > 4" class="muted">…</span>
          <button class="rpt-page-num" *ngIf="totalPages() >= 4" [class.rpt-page-num--active]="currentPage === totalPages()" (click)="currentPage = totalPages()" type="button">{{ totalPages() }}</button>
          <button class="rpt-page-btn" [disabled]="currentPage === totalPages()" (click)="currentPage = currentPage + 1" type="button">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <select class="rpt-page-size" [(ngModel)]="pageSize">
            <option [value]="5">5 / page</option>
            <option [value]="10">10 / page</option>
            <option [value]="25">25 / page</option>
          </select>
        </div>
      </div>
    </div><!-- rpt-main -->

    <!-- ── DETAIL PANEL ────────────────────────────────────── -->
    <div class="rpt-detail" *ngIf="selectedId">
      <ng-container *ngIf="selectedReport() as r">

        <!-- Detail header -->
        <div class="rpt-detail__head">
          <div class="rpt-detail__head-top">
            <div>
              <div class="rpt-detail__title">{{ r.title }}</div>
              <div class="rpt-detail__module muted" style="font-size:.73rem;display:flex;align-items:center;gap:.35rem;margin-top:.2rem">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                {{ r.module }}
              </div>
            </div>
            <div style="display:flex;align-items:flex-start;gap:.5rem;flex-shrink:0">
              <span class="rpt-status rpt-status--{{ r.status }}">{{ statusLabel(r.status) }}</span>
              <button class="rpt-detail__close" type="button" (click)="closeDetail()">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Meta rows -->
        <div class="rpt-detail__meta">
          <div class="rpt-drow"><span class="rpt-drow__k">Période</span><span class="rpt-drow__v">{{ r.periodLabel }}</span></div>
          <div class="rpt-drow"><span class="rpt-drow__k">Zone</span><span class="rpt-drow__v">{{ r.zone }}</span></div>
          <div class="rpt-drow"><span class="rpt-drow__k">Auteur</span><span class="rpt-drow__v">{{ r.author }}</span></div>
          <div class="rpt-drow"><span class="rpt-drow__k">Institution</span><span class="rpt-drow__v">{{ r.institution }}</span></div>
          <div class="rpt-drow"><span class="rpt-drow__k">Créé le</span><span class="rpt-drow__v">{{ r.createdAt }}</span></div>
          <div class="rpt-drow"><span class="rpt-drow__k">Format</span><span class="rpt-drow__v">{{ r.format.toUpperCase() }} {{ r.fileSize !== '—' ? '(' + r.fileSize + ')' : '' }}</span></div>
        </div>

        <!-- Thumbnail -->
        <div class="rpt-thumb-wrap">
          <div class="rpt-thumb" [style.border-color]="typeColor(r.type)">
            <div class="rpt-thumb__bar" [style.background]="typeColor(r.type)">
              <span class="rpt-thumb__logo">DINEPA</span>
            </div>
            <div class="rpt-thumb__content">
              <div class="rpt-thumb__type" [style.color]="typeColor(r.type)">{{ r.module.toUpperCase() }}</div>
              <div class="rpt-thumb__period muted">{{ r.periodLabel }}</div>
              <div class="rpt-thumb__zone">{{ r.zone }}</div>
            </div>
            <div class="rpt-thumb__footer">
              <div class="rpt-thumb__img-placeholder"></div>
            </div>
          </div>
          <span class="rpt-thumb__version muted">Version {{ r.version }}</span>
        </div>

        <!-- Sections -->
        <div class="rpt-detail__section">
          <div class="rpt-detail__sec-title">CONTENU DU RAPPORT</div>
          <div class="rpt-section-list">
            <div class="rpt-section-item" *ngFor="let s of r.sections">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>{{ s }}</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="rpt-detail__section">
          <div class="rpt-detail__sec-title">ACTIONS</div>
          <div class="rpt-dl-row">
            <button class="rpt-dl-btn rpt-dl-btn--pdf" type="button" (click)="notifyDownloadPDF()">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Télécharger PDF
            </button>
            <button class="rpt-dl-btn rpt-dl-btn--word" type="button" (click)="notifyDownloadWord()">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Télécharger Word
            </button>
            <button class="rpt-dl-btn rpt-dl-btn--excel" type="button" (click)="notifyDownloadExcel()">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Télécharger Excel
            </button>
          </div>
          <div class="rpt-other-actions">
            <button class="rpt-action-btn" type="button" (click)="notifyEmail()">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Envoyer par email
            </button>
          </div>
          <div class="rpt-two-actions">
            <button class="rpt-action-btn" type="button" (click)="notifyDuplicate()">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Dupliquer
            </button>
            <button class="rpt-action-btn" type="button" (click)="notifyArchive()">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
              Archiver
            </button>
          </div>
        </div>

        <!-- Versions -->
        <div class="rpt-detail__section" *ngIf="r.versions.length > 0">
          <div class="rpt-detail__sec-title">VERSIONS</div>
          <div class="rpt-version-list">
            <div class="rpt-ver-item" *ngFor="let v of r.versions">
              <div class="rpt-ver-dot"></div>
              <div class="rpt-ver-body">
                <span class="rpt-ver-label">{{ v.version }} — {{ v.changes }}</span>
                <span class="muted rpt-ver-date">{{ v.createdBy }} · {{ v.createdAt }}</span>
              </div>
            </div>
          </div>
        </div>

      </ng-container>
    </div>

  </div><!-- rpt-body -->
</div><!-- rpt-shell -->

<!-- ══ OVERLAY ══════════════════════════════════════════════ -->
<div class="rpt-overlay" *ngIf="showCreateDrawer || showTemplatesDrawer"
  (click)="showCreateDrawer = false; showTemplatesDrawer = false"></div>

<!-- ══ CRÉER UN RAPPORT DRAWER ══════════════════════════════ -->
<div class="rpt-drawer" [class.rpt-drawer--open]="showCreateDrawer">
  <div class="rpt-drawer__head">
    <div>
      <h2 class="rpt-drawer__title">Créer un rapport</h2>
      <p class="rpt-drawer__sub muted">Étape {{ createStep }} sur 6</p>
    </div>
    <button class="rpt-drawer__close" type="button" (click)="showCreateDrawer = false">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  <!-- Stepper -->
  <div class="rpt-stepper">
    <div class="rpt-step" [class.rpt-step--active]="createStep === 1" [class.rpt-step--done]="createStep > 1">
      <div class="rpt-step__num">
        <svg *ngIf="createStep > 1" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span *ngIf="createStep <= 1">1</span>
      </div>
      <span class="rpt-step__lbl">Type</span>
    </div>
    <div class="rpt-step-line" [class.rpt-step-line--done]="createStep > 1"></div>
    <div class="rpt-step" [class.rpt-step--active]="createStep === 2" [class.rpt-step--done]="createStep > 2">
      <div class="rpt-step__num">
        <svg *ngIf="createStep > 2" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span *ngIf="createStep <= 2">2</span>
      </div>
      <span class="rpt-step__lbl">Zone</span>
    </div>
    <div class="rpt-step-line" [class.rpt-step-line--done]="createStep > 2"></div>
    <div class="rpt-step" [class.rpt-step--active]="createStep === 3" [class.rpt-step--done]="createStep > 3">
      <div class="rpt-step__num">
        <svg *ngIf="createStep > 3" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span *ngIf="createStep <= 3">3</span>
      </div>
      <span class="rpt-step__lbl">Période</span>
    </div>
    <div class="rpt-step-line" [class.rpt-step-line--done]="createStep > 3"></div>
    <div class="rpt-step" [class.rpt-step--active]="createStep === 4" [class.rpt-step--done]="createStep > 4">
      <div class="rpt-step__num">
        <svg *ngIf="createStep > 4" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span *ngIf="createStep <= 4">4</span>
      </div>
      <span class="rpt-step__lbl">Contenu</span>
    </div>
    <div class="rpt-step-line" [class.rpt-step-line--done]="createStep > 4"></div>
    <div class="rpt-step" [class.rpt-step--active]="createStep === 5" [class.rpt-step--done]="createStep > 5">
      <div class="rpt-step__num">
        <svg *ngIf="createStep > 5" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span *ngIf="createStep <= 5">5</span>
      </div>
      <span class="rpt-step__lbl">Format</span>
    </div>
    <div class="rpt-step-line" [class.rpt-step-line--done]="createStep > 5"></div>
    <div class="rpt-step" [class.rpt-step--active]="createStep === 6">
      <div class="rpt-step__num"><span>6</span></div>
      <span class="rpt-step__lbl">Générer</span>
    </div>
  </div>

  <div class="rpt-drawer__body">

    <!-- STEP 1 — Type -->
    <div *ngIf="createStep === 1">
      <div class="rpt-d-sec-title">Choisissez le type de rapport</div>
      <div class="rpt-type-grid">
        <button class="rpt-type-card" [class.rpt-type-card--sel]="createForm.type === 'service'" (click)="createForm.type = 'service'" type="button">
          <div class="rpt-type-icon-lg" style="background:#eff6ff;color:#2563eb"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
          <span class="rpt-type-card__lbl">Rapport de service</span>
          <span class="rpt-type-card__desc">Disponibilité et desserte</span>
        </button>
        <button class="rpt-type-card" [class.rpt-type-card--sel]="createForm.type === 'alertes'" (click)="createForm.type = 'alertes'" type="button">
          <div class="rpt-type-icon-lg" style="background:#fff7ed;color:#ea580c"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg></div>
          <span class="rpt-type-card__lbl">Rapport d'incidents</span>
          <span class="rpt-type-card__desc">Alertes et anomalies</span>
        </button>
        <button class="rpt-type-card" [class.rpt-type-card--sel]="createForm.type === 'interventions'" (click)="createForm.type = 'interventions'" type="button">
          <div class="rpt-type-icon-lg" style="background:#f0fdfa;color:#0d9488"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>
          <span class="rpt-type-card__lbl">Rapport d'interventions</span>
          <span class="rpt-type-card__desc">Travaux et visites terrain</span>
        </button>
        <button class="rpt-type-card" [class.rpt-type-card--sel]="createForm.type === 'infrastructures'" (click)="createForm.type = 'infrastructures'" type="button">
          <div class="rpt-type-icon-lg" style="background:#f8fafc;color:#475569"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M2 20h20M4 20V8l8-6 8 6v12"/><rect x="9" y="14" width="6" height="6"/></svg></div>
          <span class="rpt-type-card__lbl">Rapport d'infrastructures</span>
          <span class="rpt-type-card__desc">État des ouvrages</span>
        </button>
        <button class="rpt-type-card" [class.rpt-type-card--sel]="createForm.type === 'iot'" (click)="createForm.type = 'iot'" type="button">
          <div class="rpt-type-icon-lg" style="background:#fdf4ff;color:#9333ea"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M1.42 9a16 16 0 0 1 21.16 0M5 12.55a11 11 0 0 1 14.08 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg></div>
          <span class="rpt-type-card__lbl">Rapport IoT</span>
          <span class="rpt-type-card__desc">Données capteurs</span>
        </button>
        <button class="rpt-type-card" [class.rpt-type-card--sel]="createForm.type === 'qualite'" (click)="createForm.type = 'qualite'" type="button">
          <div class="rpt-type-icon-lg" style="background:#ecfeff;color:#0891b2"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg></div>
          <span class="rpt-type-card__lbl">Rapport de qualité</span>
          <span class="rpt-type-card__desc">pH, turbidité, chlore</span>
        </button>
        <button class="rpt-type-card" [class.rpt-type-card--sel]="createForm.type === 'traceabilite'" (click)="createForm.type = 'traceabilite'" type="button">
          <div class="rpt-type-icon-lg" style="background:#eef2ff;color:#4f46e5"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <span class="rpt-type-card__lbl">Rapport d'audit</span>
          <span class="rpt-type-card__desc">Journal et traçabilité</span>
        </button>
        <button class="rpt-type-card" [class.rpt-type-card--sel]="createForm.type === 'executif'" (click)="createForm.type = 'executif'" type="button">
          <div class="rpt-type-icon-lg" style="background:#fffbeb;color:#d97706"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
          <span class="rpt-type-card__lbl">Résumé exécutif</span>
          <span class="rpt-type-card__desc">Synthèse décideurs</span>
        </button>
      </div>
    </div>

    <!-- STEP 2 — Zone -->
    <div *ngIf="createStep === 2">
      <div class="rpt-d-sec-title">Choisissez la portée géographique</div>
      <div class="rpt-scope-grid">
        <button class="rpt-scope-btn" [class.rpt-scope-btn--sel]="createForm.scopeType === 'national'" (click)="createForm.scopeType = 'national'" type="button">National</button>
        <button class="rpt-scope-btn" [class.rpt-scope-btn--sel]="createForm.scopeType === 'departement'" (click)="createForm.scopeType = 'departement'" type="button">Département</button>
        <button class="rpt-scope-btn" [class.rpt-scope-btn--sel]="createForm.scopeType === 'commune'" (click)="createForm.scopeType = 'commune'" type="button">Commune</button>
        <button class="rpt-scope-btn" [class.rpt-scope-btn--sel]="createForm.scopeType === 'section'" (click)="createForm.scopeType = 'section'" type="button">Section communale</button>
        <button class="rpt-scope-btn" [class.rpt-scope-btn--sel]="createForm.scopeType === 'infrastructure'" (click)="createForm.scopeType = 'infrastructure'" type="button">Infrastructure</button>
        <button class="rpt-scope-btn" [class.rpt-scope-btn--sel]="createForm.scopeType === 'point'" (click)="createForm.scopeType = 'point'" type="button">Point d'eau</button>
      </div>
      <div class="rpt-d-form-group" *ngIf="createForm.scopeType !== 'national'">
        <label class="rpt-d-label">Zone / Portée</label>
        <select class="rpt-d-select" [(ngModel)]="createForm.zone">
          <option value="Léogâne">Léogâne</option>
          <option value="Petit-Goâve">Petit-Goâve</option>
          <option value="Grand-Goâve">Grand-Goâve</option>
          <option value="Ouest">Département Ouest</option>
          <option value="Dessources">Section Dessources</option>
          <option value="R-01">Réservoir R-01</option>
        </select>
      </div>
      <div class="rpt-d-form-group" *ngIf="createForm.scopeType === 'national'">
        <div class="rpt-info-box">Portée nationale — toutes les zones du réseau seront incluses.</div>
      </div>
    </div>

    <!-- STEP 3 — Période -->
    <div *ngIf="createStep === 3">
      <div class="rpt-d-sec-title">Choisissez la période couverte</div>
      <div class="rpt-preset-grid">
        <button class="rpt-preset-btn" [class.rpt-preset-btn--sel]="createForm.periodPreset === 'today'" (click)="createForm.periodPreset = 'today'" type="button">Aujourd'hui</button>
        <button class="rpt-preset-btn" [class.rpt-preset-btn--sel]="createForm.periodPreset === '7days'" (click)="createForm.periodPreset = '7days'" type="button">7 derniers jours</button>
        <button class="rpt-preset-btn" [class.rpt-preset-btn--sel]="createForm.periodPreset === '30days'" (click)="createForm.periodPreset = '30days'" type="button">30 derniers jours</button>
        <button class="rpt-preset-btn" [class.rpt-preset-btn--sel]="createForm.periodPreset === 'month'" (click)="createForm.periodPreset = 'month'" type="button">Mois en cours</button>
        <button class="rpt-preset-btn" [class.rpt-preset-btn--sel]="createForm.periodPreset === 'custom'" (click)="createForm.periodPreset = 'custom'" type="button">Période personnalisée</button>
      </div>
      <div class="rpt-d-form-row" *ngIf="createForm.periodPreset === 'custom'">
        <div class="rpt-d-form-group">
          <label class="rpt-d-label">Du</label>
          <input type="date" class="rpt-d-input" [(ngModel)]="createForm.dateFrom">
        </div>
        <div class="rpt-d-form-group">
          <label class="rpt-d-label">Au</label>
          <input type="date" class="rpt-d-input" [(ngModel)]="createForm.dateTo">
        </div>
      </div>
    </div>

    <!-- STEP 4 — Contenu -->
    <div *ngIf="createStep === 4">
      <div class="rpt-d-sec-title">Choisissez le contenu à inclure</div>
      <div class="rpt-check-grid">
        <label class="rpt-check-item"><input type="checkbox" [(ngModel)]="createForm.inclResume"><span>Résumé exécutif</span></label>
        <label class="rpt-check-item"><input type="checkbox" [(ngModel)]="createForm.inclCarte"><span>Cartes</span></label>
        <label class="rpt-check-item"><input type="checkbox" [(ngModel)]="createForm.inclTableaux"><span>Tableaux de données</span></label>
        <label class="rpt-check-item"><input type="checkbox" [(ngModel)]="createForm.inclGraphiques"><span>Graphiques</span></label>
        <label class="rpt-check-item"><input type="checkbox" [(ngModel)]="createForm.inclAlertes"><span>Alertes</span></label>
        <label class="rpt-check-item"><input type="checkbox" [(ngModel)]="createForm.inclInterventions"><span>Interventions</span></label>
        <label class="rpt-check-item"><input type="checkbox" [(ngModel)]="createForm.inclPhotos"><span>Photos terrain</span></label>
        <label class="rpt-check-item"><input type="checkbox" [(ngModel)]="createForm.inclIoT"><span>Données IoT</span></label>
        <label class="rpt-check-item"><input type="checkbox" [(ngModel)]="createForm.inclTrace"><span>Traçabilité</span></label>
        <label class="rpt-check-item"><input type="checkbox" [(ngModel)]="createForm.inclAnnexes"><span>Annexes</span></label>
        <label class="rpt-check-item"><input type="checkbox" [(ngModel)]="createForm.inclSignatures"><span>Signatures</span></label>
      </div>
    </div>

    <!-- STEP 5 — Format -->
    <div *ngIf="createStep === 5">
      <div class="rpt-d-sec-title">Choisissez le format de sortie</div>
      <div class="rpt-format-cards">
        <button class="rpt-format-card" [class.rpt-format-card--sel]="createForm.format === 'pdf'" (click)="createForm.format = 'pdf'" type="button">
          <div class="rpt-format-card__icon" style="background:#fef2f2;color:#dc2626">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <span class="rpt-format-card__lbl">PDF</span>
          <span class="rpt-format-card__desc">Document figé, idéal pour partage officiel</span>
        </button>
        <button class="rpt-format-card" [class.rpt-format-card--sel]="createForm.format === 'docx'" (click)="createForm.format = 'docx'" type="button">
          <div class="rpt-format-card__icon" style="background:#eff6ff;color:#2563eb">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
          </div>
          <span class="rpt-format-card__lbl">Word (DOCX)</span>
          <span class="rpt-format-card__desc">Modifiable, pour révision et annotations</span>
        </button>
        <button class="rpt-format-card" [class.rpt-format-card--sel]="createForm.format === 'xlsx'" (click)="createForm.format = 'xlsx'" type="button">
          <div class="rpt-format-card__icon" style="background:#f0fdf4;color:#16a34a">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
          </div>
          <span class="rpt-format-card__lbl">Excel (XLSX)</span>
          <span class="rpt-format-card__desc">Données tabulaires, graphiques dynamiques</span>
        </button>
      </div>
    </div>

    <!-- STEP 6 — Génération -->
    <div *ngIf="createStep === 6">
      <div class="rpt-d-sec-title">Récapitulatif</div>
      <div class="rpt-recap">
        <div class="rpt-recap-row"><span class="rpt-recap-k">Type de rapport</span><span class="rpt-recap-v">{{ typeLabel(createForm.type) }}</span></div>
        <div class="rpt-recap-row"><span class="rpt-recap-k">Portée</span><span class="rpt-recap-v">{{ createForm.scopeType === 'national' ? 'National' : createForm.zone }}</span></div>
        <div class="rpt-recap-row"><span class="rpt-recap-k">Période</span><span class="rpt-recap-v">{{ periodLabel() }}</span></div>
        <div class="rpt-recap-row"><span class="rpt-recap-k">Format</span><span class="rpt-recap-v">{{ createForm.format.toUpperCase() }}</span></div>
      </div>
      <div class="rpt-recap-generate">
        <button class="rpt-btn rpt-btn--primary rpt-btn--lg" type="button" (click)="submitCreate()">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="13 2 13 9 20 9"/><path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h5.34"/><polygon points="18 2 22 6 12 16 8 16 8 12 18 2"/></svg>
          Générer le rapport
        </button>
        <p class="muted" style="font-size:.75rem;text-align:center;margin:.5rem 0 0">
          Le rapport sera disponible dans la bibliothèque après génération.
        </p>
      </div>
    </div>

  </div><!-- rpt-drawer__body -->

  <div class="rpt-drawer__foot">
    <button class="rpt-btn rpt-btn--ghost" type="button" (click)="showCreateDrawer = false">Annuler</button>
    <div style="display:flex;gap:.5rem">
      <button class="rpt-btn rpt-btn--outline" type="button" *ngIf="createStep > 1" (click)="prevStep()">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        Précédent
      </button>
      <button class="rpt-btn rpt-btn--primary" type="button" *ngIf="createStep < 6" (click)="nextStep()">
        Suivant
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  </div>
</div>

<!-- ══ MODÈLES DRAWER ══════════════════════════════════════ -->
<div class="rpt-drawer rpt-drawer--wide" [class.rpt-drawer--open]="showTemplatesDrawer">
  <div class="rpt-drawer__head">
    <div>
      <h2 class="rpt-drawer__title">Modèles de rapport</h2>
      <p class="rpt-drawer__sub muted">Démarrez depuis un modèle institutionnel prédéfini</p>
    </div>
    <button class="rpt-drawer__close" type="button" (click)="showTemplatesDrawer = false">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div class="rpt-drawer__body">
    <div class="rpt-tpl-grid">
      <div class="rpt-tpl-card" *ngFor="let tpl of templates">
        <div class="rpt-tpl-icon" [style.background]="tpl.bg" [style.color]="tpl.color">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </div>
        <div class="rpt-tpl-body">
          <div class="rpt-tpl-name">{{ tpl.name }}</div>
          <div class="rpt-tpl-desc muted">{{ tpl.desc }}</div>
        </div>
        <button class="rpt-tpl-use" type="button" (click)="useTemplate(tpl.name)">Utiliser</button>
      </div>
    </div>
  </div>
  <div class="rpt-drawer__foot">
    <button class="rpt-btn rpt-btn--ghost" type="button" (click)="showTemplatesDrawer = false">Fermer</button>
  </div>
</div>
  `,
  styles: []
})
export class ReportsPageComponent {

  selectedId?: string;
  showCreateDrawer = false;
  showTemplatesDrawer = false;
  createStep = 1;

  filterDept = '';
  filterCommune = '';
  filterSection = '';
  filterModule = '';
  filterType = '';
  filterStatus = '';
  filterAuthor = '';
  filterInstitution = '';
  filterFormat = '';
  filterDateFrom = '2026-04-01';
  filterDateTo = '2026-04-29';
  searchQuery = '';

  currentPage = 1;
  pageSize = 10;

  readonly reports = REPORTS;

  createForm = {
    type: '' as ReportType | '',
    scopeType: 'commune' as 'national' | 'departement' | 'commune' | 'section' | 'infrastructure' | 'point',
    zone: 'Léogâne',
    periodPreset: 'month' as 'today' | '7days' | '30days' | 'month' | 'custom',
    dateFrom: '2026-04-01',
    dateTo: '2026-04-29',
    inclResume: true, inclCarte: true, inclTableaux: true, inclGraphiques: false,
    inclAlertes: true, inclInterventions: true, inclPhotos: false,
    inclIoT: true, inclTrace: false, inclAnnexes: false, inclSignatures: true,
    format: 'pdf' as 'pdf' | 'docx' | 'xlsx',
  };

  readonly templates = [
    { name: 'Modèle institutionnel DINEPA', desc: 'En-tête officiel DINEPA, structure complète, signature.', bg: '#eff6ff', color: '#2563eb' },
    { name: 'Modèle mairie', desc: 'Format adapté pour les collectivités locales.', bg: '#f0fdf4', color: '#16a34a' },
    { name: 'Modèle intervention terrain', desc: 'Tâches, mesures, photos avant/après, signature technicien.', bg: '#f0fdfa', color: '#0d9488' },
    { name: 'Modèle audit interne', desc: 'Journal actions sensibles, modifications, traçabilité complète.', bg: '#eef2ff', color: '#4f46e5' },
    { name: 'Modèle bailleur / partenaire', desc: 'Résumé exécutif, indicateurs KPI, annexes photos.', bg: '#fffbeb', color: '#d97706' },
    { name: 'Modèle résumé exécutif', desc: 'Synthèse courte pour décideurs, 2 pages maximum.', bg: '#fdf4ff', color: '#9333ea' },
  ];

  constructor(readonly toast: ToastService) {}

  filteredReports(): ReportEntry[] {
    return this.reports.filter(r => {
      if (this.filterStatus && r.status !== this.filterStatus) return false;
      if (this.filterType && r.type !== this.filterType) return false;
      if (this.filterModule && r.module !== this.filterModule) return false;
      if (this.filterFormat && r.format !== this.filterFormat) return false;
      if (this.filterAuthor && r.author !== this.filterAuthor) return false;
      if (this.filterInstitution && r.institution !== this.filterInstitution) return false;
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        if (!r.title.toLowerCase().includes(q) && !r.subtitle.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  pagedReports(): ReportEntry[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredReports().slice(start, start + +this.pageSize);
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredReports().length / +this.pageSize));
  }

  selectedReport(): ReportEntry | undefined {
    return this.reports.find(r => r.id === this.selectedId);
  }

  selectReport(id: string): void {
    this.selectedId = id;
  }

  closeDetail(): void {
    this.selectedId = undefined;
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = {
      brouillon: 'Brouillon', genere: 'Généré', valide: 'Validé',
      transmis: 'Transmis', archive: 'Archivé', echec: 'Échec',
    };
    return map[s] ?? s;
  }

  typeLabelShort(t: string): string {
    const map: Record<string, string> = {
      service: 'Service', alertes: 'Alertes', interventions: 'Interventions',
      infrastructures: 'Infrastructures', iot: 'IoT', qualite: 'Qualité',
      traceabilite: 'Traçabilité', executif: 'Exécutif',
    };
    return map[t] ?? t;
  }

  typeLabel(t: string): string {
    const map: Record<string, string> = {
      service: 'Rapport de service', alertes: "Rapport d'incidents",
      interventions: "Rapport d'interventions", infrastructures: "Rapport d'infrastructures",
      iot: 'Rapport IoT', qualite: "Rapport de qualité",
      traceabilite: "Rapport d'audit", executif: 'Résumé exécutif',
    };
    return map[t] ?? t;
  }

  typeColor(t: string): string {
    const map: Record<string, string> = {
      service: '#2563eb', alertes: '#ea580c', interventions: '#0d9488',
      infrastructures: '#475569', iot: '#9333ea', qualite: '#0891b2',
      traceabilite: '#4f46e5', executif: '#d97706',
    };
    return map[t] ?? '#64748b';
  }

  typeBg(t: string): string {
    const map: Record<string, string> = {
      service: '#eff6ff', alertes: '#fff7ed', interventions: '#f0fdfa',
      infrastructures: '#f8fafc', iot: '#fdf4ff', qualite: '#ecfeff',
      traceabilite: '#eef2ff', executif: '#fffbeb',
    };
    return map[t] ?? '#f8fafc';
  }

  periodLabel(): string {
    const map: Record<string, string> = {
      today: "Aujourd'hui", '7days': '7 derniers jours',
      '30days': '30 derniers jours', month: 'Mois en cours',
      custom: `${this.createForm.dateFrom} – ${this.createForm.dateTo}`,
    };
    return map[this.createForm.periodPreset] ?? '';
  }

  resetFilters(): void {
    this.filterDept = ''; this.filterCommune = ''; this.filterSection = '';
    this.filterModule = ''; this.filterType = ''; this.filterStatus = '';
    this.filterAuthor = ''; this.filterInstitution = ''; this.filterFormat = '';
    this.searchQuery = ''; this.currentPage = 1;
  }

  nextStep(): void {
    if (this.createStep < 6) this.createStep++;
  }

  prevStep(): void {
    if (this.createStep > 1) this.createStep--;
  }

  submitCreate(): void {
    this.showCreateDrawer = false;
    this.createStep = 1;
    this.toast.push('success', 'Rapport en cours de génération — vous serez notifié');
  }

  useTemplate(name: string): void {
    this.showTemplatesDrawer = false;
    this.showCreateDrawer = true;
    this.toast.push('info', `Modèle chargé : ${name}`);
  }

  notifyExportList(): void {
    this.toast.push('info', 'Export de la liste des rapports en cours...');
  }

  notifyDownloadPDF(): void {
    this.toast.push('success', 'Téléchargement du rapport PDF en cours...');
  }

  notifyDownloadWord(): void {
    this.toast.push('info', 'Téléchargement du rapport Word en cours...');
  }

  notifyDownloadExcel(): void {
    this.toast.push('info', 'Téléchargement du rapport Excel en cours...');
  }

  notifyEmail(): void {
    this.toast.push('success', 'Rapport envoyé par email avec succès');
  }

  notifyDuplicate(): void {
    this.toast.push('info', 'Rapport dupliqué — brouillon créé');
  }

  notifyArchive(): void {
    this.toast.push('info', 'Rapport archivé avec succès');
  }

  notifyRowAction(): void {
    this.toast.push('info', 'Actions disponibles dans le panneau de droite');
  }
}
