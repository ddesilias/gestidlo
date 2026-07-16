import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../ui/toast.service';

type TraceTab = 'journal' | 'interventions' | 'anomalies' | 'rapports' | 'validations' | 'exports';
type DetailTab = 'resume' | 'taches' | 'mesures' | 'anomalies' | 'preuves';
type IntervStatus = 'en_cours' | 'terminee' | 'a_verifier' | 'planifiee' | 'cloturee' | 'rejetee';

/** Type d'événement journalisé — élargi au workflow réel des rapports A4 (soumission → signature → archivage). */
type JournalType = 'create' | 'update' | 'assign' | 'validate' | 'delete'
                 | 'submit' | 'return' | 'sign' | 'archive' | 'export';
/** Niveau d'impact d'un événement, pour la lisibilité « directeur ». */
type JournalImpact = 'critique' | 'important' | 'normal' | 'info';

interface Task { label: string; done: boolean; }
interface Measure { label: string; value: string; unit: string; }
interface Anomaly { id: string; label: string; severity: 'haute' | 'moyenne' | 'basse'; date: string; status: 'ouverte' | 'en_cours' | 'resolue'; }
interface ActivityEntry { timestamp: string; label: string; author: string; type: 'photo' | 'measure' | 'anomaly' | 'start' | 'task' | 'note'; detail?: string; }

interface Intervention {
  id: string;
  type: string;
  infrastructure: string;
  commune: string;
  department: string;
  status: IntervStatus;
  priority: 'haute' | 'moyenne' | 'basse';
  tasks: Task[];
  measures: Measure[];
  anomalies: Anomaly[];
  startedAt: string;
  startedDate: string;
  technicien: string;
  responsable: string;
  triggerSource: string;
  photos: number;
  activityLog: ActivityEntry[];
}

interface JournalEntry {
  timestamp: string;
  user: string;
  role: string;
  /** Territoire de l'action — le « où » qui manquait : « URD Ouest · Léogâne », « National »… */
  zone: string;
  module: string;
  action: string;
  element: string;
  /** Ex-« détail » → Résultat / Impact : la conséquence concrète de l'action. */
  result: string;
  impact: JournalImpact;
  type: JournalType;
  // ── Preuve complète (panneau de détail au clic) ──
  oldValue?: string;
  newValue?: string;
  motif?: string;
  linkedReport?: string;
  linkedIntervention?: string;
}

interface AnomalyRecord {
  id: string;
  label: string;
  source: string;
  infrastructure: string;
  severity: 'haute' | 'moyenne' | 'basse' | 'critique';
  status: 'ouverte' | 'en_cours' | 'resolue';
  date: string;
  intervention?: string;
}

const INTERVENTIONS: Intervention[] = [
  {
    id: 'INT-2026-001',
    type: 'Vérification réservoir',
    infrastructure: 'Réservoir R-01',
    commune: 'Léogâne',
    department: 'Ouest',
    status: 'en_cours',
    priority: 'haute',
    tasks: [
      { label: 'Port des EPI', done: true },
      { label: 'Contrôler l\'état physique du réservoir', done: true },
      { label: 'Relever le niveau d\'eau', done: true },
      { label: 'Vérifier le capteur de niveau', done: true },
      { label: 'Contrôler le débit entrant', done: false },
      { label: 'Contrôler la pression', done: false },
      { label: 'Ajouter photo avant/après', done: false },
      { label: 'Soumettre rapport final', done: false },
    ],
    measures: [
      { label: 'Niveau d\'eau', value: '68', unit: '%' },
      { label: 'Débit entrant', value: '1.8', unit: 'L/s' },
      { label: 'Pression', value: '1.4', unit: 'bar' },
    ],
    anomalies: [
      { id: 'ANO-001', label: 'Capteur pression instable', severity: 'haute', date: '29/04/2026 09:40', status: 'ouverte' },
    ],
    startedAt: '09:15',
    startedDate: '29/04/2026',
    technicien: 'Jean Michel',
    responsable: 'DINEPA Ouest',
    triggerSource: 'Alerte niveau bas (IoT)',
    photos: 2,
    activityLog: [
      { timestamp: '29/04/2026 10:21', label: 'Photo ajoutée', author: 'Jean Michel', type: 'photo' },
      { timestamp: '29/04/2026 10:05', label: 'Mesure relevée — Niveau d\'eau : 68 %', author: 'Jean Michel', type: 'measure' },
      { timestamp: '29/04/2026 09:40', label: 'Anomalie signalée — Capteur pression instable', author: 'Jean Michel', type: 'anomaly', detail: 'Haute priorité' },
      { timestamp: '29/04/2026 09:15', label: 'Intervention démarrée', author: 'Jean Michel', type: 'start' },
    ],
  },
  {
    id: 'INT-2026-002',
    type: 'Vérification point d\'eau',
    infrastructure: 'Point d\'eau PE-03',
    commune: 'Jacmel',
    department: 'Sud-Est',
    status: 'terminee',
    priority: 'moyenne',
    tasks: [
      { label: 'Vérifier disponibilité eau', done: true },
      { label: 'Tester la pression', done: true },
      { label: 'Inspecter état du robinet', done: true },
      { label: 'Mesurer le débit', done: true },
      { label: 'Saisir les mesures', done: true },
      { label: 'Ajouter photos', done: true },
      { label: 'Valider rapport', done: true },
      { label: 'Clôturer l\'intervention', done: true },
    ],
    measures: [
      { label: 'Débit', value: '12.4', unit: 'L/min' },
      { label: 'Pression', value: '0.85', unit: 'bar' },
    ],
    anomalies: [],
    startedAt: '16:40',
    startedDate: '28/04/2026',
    technicien: 'Marc Étienne',
    responsable: 'OREPA Sud-Est',
    triggerSource: 'Contrôle périodique',
    photos: 3,
    activityLog: [
      { timestamp: '28/04/2026 18:10', label: 'Rapport validé et intervention clôturée', author: 'Marc Étienne', type: 'task' },
      { timestamp: '28/04/2026 17:45', label: 'Photos terrain ajoutées (3)', author: 'Marc Étienne', type: 'photo' },
      { timestamp: '28/04/2026 17:20', label: 'Mesures saisies', author: 'Marc Étienne', type: 'measure' },
      { timestamp: '28/04/2026 16:40', label: 'Intervention démarrée', author: 'Marc Étienne', type: 'start' },
    ],
  },
  {
    id: 'INT-2026-003',
    type: 'Vérification capteur IoT',
    infrastructure: 'Capteur LVL-R01',
    commune: 'Léogâne',
    department: 'Ouest',
    status: 'a_verifier',
    priority: 'moyenne',
    tasks: [
      { label: 'Vérifier alimentation capteur', done: true },
      { label: 'Tester la transmission', done: true },
      { label: 'Valider la cohérence des mesures', done: true },
      { label: 'Recalibrer si nécessaire', done: true },
      { label: 'Documenter l\'état du capteur', done: false },
    ],
    measures: [
      { label: 'Batterie', value: '82', unit: '%' },
      { label: 'Signal', value: '-67', unit: 'dBm' },
    ],
    anomalies: [
      { id: 'ANO-002', label: 'Dérive mesure capteur', severity: 'moyenne', date: '28/04/2026 10:05', status: 'en_cours' },
    ],
    startedAt: '10:05',
    startedDate: '28/04/2026',
    technicien: 'Pierre Louis',
    responsable: 'DINEPA Ouest',
    triggerSource: 'Anomalie capteur signalée',
    photos: 1,
    activityLog: [
      { timestamp: '28/04/2026 11:30', label: 'Recalibration effectuée', author: 'Pierre Louis', type: 'task' },
      { timestamp: '28/04/2026 10:50', label: 'Photo capteur ajoutée', author: 'Pierre Louis', type: 'photo' },
      { timestamp: '28/04/2026 10:05', label: 'Intervention démarrée', author: 'Pierre Louis', type: 'start' },
    ],
  },
  {
    id: 'INT-2026-004',
    type: 'Maintenance pompe',
    infrastructure: 'Pompe P-02',
    commune: 'Petit-Goâve',
    department: 'Ouest',
    status: 'en_cours',
    priority: 'haute',
    tasks: [
      { label: 'Couper l\'alimentation électrique', done: true },
      { label: 'Vérifier l\'état mécanique', done: true },
      { label: 'Nettoyer les filtres', done: true },
      { label: 'Remplacer les joints', done: false },
      { label: 'Tester le redémarrage', done: false },
      { label: 'Valider le débit de sortie', done: false },
    ],
    measures: [
      { label: 'Débit sortie', value: '—', unit: 'L/s' },
      { label: 'Pression', value: '—', unit: 'bar' },
    ],
    anomalies: [
      { id: 'ANO-003', label: 'Fuite joint pompe', severity: 'haute', date: '27/04/2026 14:22', status: 'ouverte' },
    ],
    startedAt: '14:22',
    startedDate: '27/04/2026',
    technicien: 'Louis Charles',
    responsable: 'OREPA Ouest',
    triggerSource: 'Alerte pression basse',
    photos: 0,
    activityLog: [
      { timestamp: '27/04/2026 16:00', label: 'Joints anciens retirés', author: 'Louis Charles', type: 'task' },
      { timestamp: '27/04/2026 15:10', label: 'Anomalie confirmée — Fuite joint', author: 'Louis Charles', type: 'anomaly', detail: 'Haute priorité' },
      { timestamp: '27/04/2026 14:22', label: 'Intervention démarrée', author: 'Louis Charles', type: 'start' },
    ],
  },
  {
    id: 'INT-2026-005',
    type: 'Contrôle pression réseau',
    infrastructure: 'Station PRESS-01',
    commune: 'Grand-Goâve',
    department: 'Ouest',
    status: 'terminee',
    priority: 'basse',
    tasks: [
      { label: 'Relever la pression', done: true },
      { label: 'Comparer avec seuils', done: true },
      { label: 'Documenter', done: true },
      { label: 'Soumettre rapport', done: true },
      { label: 'Valider rapport', done: true },
      { label: 'Archiver', done: true },
    ],
    measures: [
      { label: 'Pression', value: '1.2', unit: 'bar' },
      { label: 'Débit', value: '3.4', unit: 'L/s' },
    ],
    anomalies: [],
    startedAt: '09:10',
    startedDate: '27/04/2026',
    technicien: 'Anne Duperval',
    responsable: 'DINEPA Ouest',
    triggerSource: 'Contrôle mensuel planifié',
    photos: 2,
    activityLog: [
      { timestamp: '27/04/2026 11:00', label: 'Rapport archivé', author: 'Anne Duperval', type: 'task' },
      { timestamp: '27/04/2026 10:30', label: 'Mesures finales relevées', author: 'Anne Duperval', type: 'measure' },
      { timestamp: '27/04/2026 09:10', label: 'Intervention démarrée', author: 'Anne Duperval', type: 'start' },
    ],
  },
];

const JOURNAL_ENTRIES: JournalEntry[] = [
  // ── Workflow des rapports A4 : soumission → validation URD → renvoi → signature DINEPA → archivage ──
  { timestamp: '29/04/2026 11:20', user: 'Directeur National', role: 'DINEPA national', zone: 'National', module: 'Rapports', action: 'Rapport signé DINEPA', element: 'RPT-SVC-001', result: 'Signé et transmis à l\'archive nationale', impact: 'important', type: 'sign', linkedReport: 'RPT-SVC-001' },
  { timestamp: '29/04/2026 10:48', user: 'Resp. URD Ouest', role: 'Responsable URD', zone: 'URD Ouest · Léogâne', module: 'Rapports', action: 'Rapport validé URD', element: 'RPT-SVC-001', result: 'Validé et signé — transmis à la DINEPA', impact: 'normal', type: 'validate', linkedReport: 'RPT-SVC-001' },
  { timestamp: '29/04/2026 09:30', user: 'Resp. URD Ouest', role: 'Responsable URD', zone: 'URD Ouest · Carrefour', module: 'Rapports', action: 'Rapport renvoyé au technicien', element: 'RPT-INT-0008', result: 'Renvoyé avec motif', impact: 'important', type: 'return', motif: 'Photos de l\'intervention manquantes et données IoT incomplètes.', linkedReport: 'RPT-INT-0008', linkedIntervention: 'INT-2026-001' },
  { timestamp: '29/04/2026 08:55', user: 'TEPAC Carrefour', role: 'Technicien TEPAC', zone: 'URD Ouest · Carrefour', module: 'Rapports', action: 'Rapport soumis à l\'URD', element: 'RPT-INT-0008', result: 'Soumis pour validation', impact: 'normal', type: 'submit', linkedReport: 'RPT-INT-0008', linkedIntervention: 'INT-2026-001' },
  { timestamp: '28/04/2026 18:20', user: 'Marc Étienne', role: 'Technicien TEPAC', zone: 'URD Sud-Est · Jacmel', module: 'Rapports', action: 'Rapport soumis à l\'URD', element: 'RPT-INT-0002', result: 'Soumis pour validation', impact: 'normal', type: 'submit', linkedReport: 'RPT-INT-0002', linkedIntervention: 'INT-2026-002' },
  { timestamp: '27/04/2026 11:05', user: 'Anne Duperval', role: 'Technicien TEPAC', zone: 'URD Ouest · Grand-Goâve', module: 'Rapports', action: 'Rapport archivé', element: 'RPT-PRESS-005', result: 'Classé — cycle terminé', impact: 'info', type: 'archive', linkedReport: 'RPT-PRESS-005', linkedIntervention: 'INT-2026-005' },

  // ── Actions opérationnelles ──
  { timestamp: '29/04/2026 10:12', user: 'Admin', role: 'Administrateur', zone: 'URD Ouest · Léogâne', module: 'Service', action: 'Statut de zone modifié', element: 'Zone Dessources', result: 'Dégradé → Normal', impact: 'normal', type: 'update', oldValue: 'Dégradé', newValue: 'Normal' },
  { timestamp: '29/04/2026 10:05', user: 'Admin', role: 'Administrateur', zone: 'URD Ouest · Léogâne', module: 'Alertes', action: 'Alerte assignée', element: 'ALT-004', result: 'Assignée à DINEPA Ouest', impact: 'important', type: 'assign', newValue: 'DINEPA Ouest' },
  { timestamp: '29/04/2026 09:55', user: 'Admin', role: 'Administrateur', zone: 'URD Ouest · Léogâne', module: 'Infrastructure', action: 'Capteur associé', element: 'Réservoir R-01', result: 'Capteur LVL-R01 rattaché à l\'ouvrage', impact: 'normal', type: 'update', newValue: 'LVL-R01' },
  { timestamp: '29/04/2026 09:40', user: 'Jean Michel', role: 'Technicien TEPAC', zone: 'URD Ouest · Léogâne', module: 'Interventions', action: 'Anomalie signalée', element: 'INT-2026-001', result: 'Capteur pression instable — priorité haute', impact: 'critique', type: 'create', linkedIntervention: 'INT-2026-001' },
  { timestamp: '29/04/2026 09:15', user: 'Jean Michel', role: 'Technicien TEPAC', zone: 'URD Ouest · Léogâne', module: 'Interventions', action: 'Intervention démarrée', element: 'INT-2026-001', result: 'Vérification Réservoir R-01', impact: 'normal', type: 'create', linkedIntervention: 'INT-2026-001' },
  { timestamp: '28/04/2026 18:10', user: 'Marc Étienne', role: 'Technicien TEPAC', zone: 'URD Sud-Est · Jacmel', module: 'Interventions', action: 'Intervention clôturée', element: 'INT-2026-002', result: 'Point d\'eau PE-03 — conforme', impact: 'normal', type: 'validate', linkedIntervention: 'INT-2026-002' },
  { timestamp: '28/04/2026 16:40', user: 'Marc Étienne', role: 'Technicien TEPAC', zone: 'URD Sud-Est · Jacmel', module: 'Interventions', action: 'Intervention démarrée', element: 'INT-2026-002', result: 'Vérification Point d\'eau PE-03', impact: 'normal', type: 'create', linkedIntervention: 'INT-2026-002' },
  { timestamp: '28/04/2026 14:00', user: 'Admin', role: 'Administrateur', zone: 'National', module: 'Ressources', action: 'Ressource modifiée', element: 'Rivière Momance', result: 'Disponibilité mise à jour', impact: 'info', type: 'update' },
  { timestamp: '28/04/2026 09:12', user: 'Admin', role: 'Administrateur', zone: 'National', module: 'Rapports', action: 'Export PDF généré', element: 'RPT-SVC-001', result: 'Feuille A4 exportée', impact: 'info', type: 'export', linkedReport: 'RPT-SVC-001' },
  { timestamp: '27/04/2026 14:22', user: 'Louis Charles', role: 'Technicien TEPAC', zone: 'URD Ouest · Petit-Goâve', module: 'Interventions', action: 'Intervention démarrée', element: 'INT-2026-004', result: 'Maintenance Pompe P-02 — fuite joint', impact: 'critique', type: 'create', linkedIntervention: 'INT-2026-004' },
  { timestamp: '27/04/2026 09:10', user: 'Anne Duperval', role: 'Technicien TEPAC', zone: 'URD Ouest · Grand-Goâve', module: 'Interventions', action: 'Intervention démarrée', element: 'INT-2026-005', result: 'Contrôle Station PRESS-01', impact: 'normal', type: 'create', linkedIntervention: 'INT-2026-005' },
];

const ANOMALY_RECORDS: AnomalyRecord[] = [
  { id: 'ANO-001', label: 'Capteur pression instable', source: 'Terrain', infrastructure: 'Réservoir R-01', severity: 'haute', status: 'ouverte', date: '29/04/2026 09:40', intervention: 'INT-2026-001' },
  { id: 'ANO-002', label: 'Dérive mesure capteur ultrasonique', source: 'IoT', infrastructure: 'Capteur LVL-R01', severity: 'moyenne', status: 'en_cours', date: '28/04/2026 10:05', intervention: 'INT-2026-003' },
  { id: 'ANO-003', label: 'Fuite joint pompe centrifuge', source: 'Terrain', infrastructure: 'Pompe P-02', severity: 'haute', status: 'ouverte', date: '27/04/2026 14:22', intervention: 'INT-2026-004' },
  { id: 'ANO-004', label: 'Niveau eau en dessous seuil critique', source: 'IoT', infrastructure: 'Réservoir R-02', severity: 'critique', status: 'en_cours', date: '27/04/2026 08:15' },
  { id: 'ANO-005', label: 'Turbidité eau hors norme', source: 'Qualité', infrastructure: 'Point d\'eau KS-04', severity: 'haute', status: 'resolue', date: '26/04/2026 11:00' },
  { id: 'ANO-006', label: 'Capteur hors ligne depuis 6h', source: 'IoT', infrastructure: 'Capteur FLOW-03', severity: 'moyenne', status: 'en_cours', date: '26/04/2026 06:30' },
];

@Component({
  selector: 'app-traceability-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="tr-shell">

  <!-- ══════════════════════════════════════════════════
       HEADER
  ══════════════════════════════════════════════════ -->
  <div class="tr-header">
    <div class="tr-header__left">
      <h1 class="tr-header__title">Traçabilité du réseau AEP</h1>
      <p class="tr-header__sub">
        Suivez l'historique complet des actions, interventions, anomalies, validations et preuves terrain,
        de la détection à la résolution.
      </p>
    </div>
    <div class="tr-header__actions">
      <button class="tr-btn tr-btn--ghost" type="button" (click)="filtresOuverts=true">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        Filtres
      </button>
      <button class="tr-btn tr-btn--ghost" type="button" (click)="setTab('exports')">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Exporter
      </button>
      <button class="tr-btn tr-btn--ghost tr-btn--subtle" type="button" (click)="notifyNouveauSuivi()">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        Ajouter une note
      </button>
      <button class="tr-btn tr-btn--primary" type="button" (click)="notifyAudit()">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        Générer rapport d'audit
      </button>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════
       KPI STRIP — la preuve chiffrée en tête
  ══════════════════════════════════════════════════ -->
  <div class="tr-kpis">
    <button class="tr-kpi" [class.tr-kpi--on]="activeTab==='journal'" (click)="setTab('journal')" type="button">
      <span class="tr-kpi__val">{{ journalEntries.length }}</span>
      <span class="tr-kpi__lbl">Événements journalisés</span>
    </button>
    <button class="tr-kpi tr-kpi--primary" [class.tr-kpi--on]="activeTab==='interventions'" (click)="setTab('interventions')" type="button">
      <span class="tr-kpi__val">{{ countByStatus('en_cours') }}</span>
      <span class="tr-kpi__lbl">Interventions en cours</span>
    </button>
    <button class="tr-kpi tr-kpi--warn" [class.tr-kpi--on]="activeTab==='anomalies'" (click)="setTab('anomalies')" type="button">
      <span class="tr-kpi__val">{{ openAnomaliesCount() }}</span>
      <span class="tr-kpi__lbl">Alertes ouvertes</span>
    </button>
    <button class="tr-kpi tr-kpi--success" [class.tr-kpi--on]="activeTab==='validations'" (click)="setTab('validations')" type="button">
      <span class="tr-kpi__val">{{ validationsCount() }}</span>
      <span class="tr-kpi__lbl">Validations &amp; signatures</span>
    </button>
    <button class="tr-kpi" [class.tr-kpi--on]="activeTab==='rapports'" (click)="setTab('rapports')" type="button">
      <span class="tr-kpi__val">{{ reportsTracked().length }}</span>
      <span class="tr-kpi__lbl">Rapports suivis</span>
    </button>
    <button class="tr-kpi" [class.tr-kpi--on]="activeTab==='exports'" (click)="setTab('exports')" type="button">
      <span class="tr-kpi__val">{{ exportsCount() }}</span>
      <span class="tr-kpi__lbl">Exports générés</span>
    </button>
  </div>

  <!-- ══════════════════════════════════════════════════
       TAB BAR
  ══════════════════════════════════════════════════ -->
  <div class="tr-tabbar">
    <button class="tr-tab" [class.tr-tab--active]="activeTab === 'journal'" (click)="setTab('journal')" type="button">Journal général</button>
    <button class="tr-tab" [class.tr-tab--active]="activeTab === 'interventions'" (click)="setTab('interventions')" type="button">Interventions</button>
    <button class="tr-tab" [class.tr-tab--active]="activeTab === 'anomalies'" (click)="setTab('anomalies')" type="button">Alertes</button>
    <button class="tr-tab" [class.tr-tab--active]="activeTab === 'rapports'" (click)="setTab('rapports')" type="button">Rapports</button>
    <button class="tr-tab" [class.tr-tab--active]="activeTab === 'validations'" (click)="setTab('validations')" type="button">Validations &amp; signatures</button>
    <button class="tr-tab" [class.tr-tab--active]="activeTab === 'exports'" (click)="setTab('exports')" type="button">Exports</button>
  </div>

  <!-- ══════════════════════════════════════════════════
       BODY — 3 columns
  ══════════════════════════════════════════════════ -->
  <div class="tr-body">

    <!-- ── FILTER DRAWER ─────────────────────────────── -->
    <ng-container *ngIf="filtresOuverts">
      <div class="tr-filter-overlay" (click)="filtresOuverts=false"></div>
      <div class="tr-filter-drawer">
        <div class="tr-filter-drawer-head">
          <span>Filtres</span>
          <button class="tr-filter-drawer-close" type="button" (click)="filtresOuverts=false">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="tr-filter-drawer-body">
          <div class="tr-filter-group">
            <label class="tr-filter-label">Période</label>
            <select class="tr-filter-select" [(ngModel)]="filterPeriod">
              <option value="1d">Aujourd'hui</option>
              <option value="7d">7 derniers jours</option>
              <option value="30d">30 derniers jours</option>
              <option value="90d">90 derniers jours</option>
            </select>
          </div>
          <div class="tr-filter-group">
            <label class="tr-filter-label">Département</label>
            <select class="tr-filter-select" [(ngModel)]="filterDepartment">
              <option value="">Tous</option>
              <option value="Ouest">Ouest</option>
              <option value="Nord">Nord</option>
              <option value="Sud">Sud</option>
              <option value="Artibonite">Artibonite</option>
              <option value="Centre">Centre</option>
              <option value="Sud-Est">Sud-Est</option>
              <option value="Nord-Est">Nord-Est</option>
              <option value="Nord-Ouest">Nord-Ouest</option>
              <option value="Nippes">Nippes</option>
              <option value="Grand'Anse">Grand'Anse</option>
            </select>
          </div>
          <div class="tr-filter-group">
            <label class="tr-filter-label">Commune</label>
            <select class="tr-filter-select" [(ngModel)]="filterCommune">
              <option value="">Toutes</option>
              <option value="Léogâne">Léogâne</option>
              <option value="Jacmel">Jacmel</option>
              <option value="Petit-Goâve">Petit-Goâve</option>
              <option value="Grand-Goâve">Grand-Goâve</option>
            </select>
          </div>
          <div class="tr-filter-group">
            <label class="tr-filter-label">Module</label>
            <select class="tr-filter-select" [(ngModel)]="filterModule">
              <option value="">Tous</option>
              <option value="Rapports">Rapports</option>
              <option value="Interventions">Interventions</option>
              <option value="Alertes">Alertes</option>
              <option value="Infrastructure">Infrastructure</option>
              <option value="Service">Service</option>
              <option value="Ressources">Ressources</option>
            </select>
          </div>
          <div class="tr-filter-group">
            <label class="tr-filter-label">Type d'action</label>
            <select class="tr-filter-select" [(ngModel)]="filterActionType">
              <option value="">Tous</option>
              <option value="create">Création</option>
              <option value="update">Modification</option>
              <option value="assign">Assignation</option>
              <option value="submit">Soumission rapport</option>
              <option value="validate">Validation</option>
              <option value="return">Renvoi</option>
              <option value="sign">Signature</option>
              <option value="archive">Archivage</option>
              <option value="export">Export</option>
              <option value="delete">Suppression</option>
            </select>
          </div>
          <div class="tr-filter-group">
            <label class="tr-filter-label">Statut</label>
            <select class="tr-filter-select" [(ngModel)]="filterStatus">
              <option value="">Tous</option>
              <option value="en_cours">En cours</option>
              <option value="terminee">Terminée</option>
              <option value="a_verifier">À vérifier</option>
              <option value="planifiee">Planifiée</option>
              <option value="cloturee">Clôturée</option>
            </select>
          </div>
          <div class="tr-filter-group">
            <label class="tr-filter-label">Responsable</label>
            <select class="tr-filter-select" [(ngModel)]="filterResponsable">
              <option value="">Tous</option>
              <option value="DINEPA Ouest">DINEPA Ouest</option>
              <option value="OREPA Ouest">OREPA Ouest</option>
              <option value="OREPA Sud-Est">OREPA Sud-Est</option>
            </select>
          </div>
          <div class="tr-filter-group">
            <label class="tr-filter-label">Infrastructure</label>
            <select class="tr-filter-select" [(ngModel)]="filterInfra">
              <option value="">Sélectionner…</option>
              <option value="Réservoir R-01">Réservoir R-01</option>
              <option value="Point d'eau PE-03">Point d'eau PE-03</option>
              <option value="Pompe P-02">Pompe P-02</option>
              <option value="Capteur LVL-R01">Capteur LVL-R01</option>
              <option value="Station PRESS-01">Station PRESS-01</option>
            </select>
          </div>
        </div>
        <div class="tr-filter-drawer-foot">
          <button class="tr-btn tr-btn--ghost" type="button" (click)="filtresOuverts=false">Fermer</button>
          <button class="tr-btn tr-btn--ghost" type="button" (click)="resetFilters()">Réinitialiser</button>
        </div>
      </div>
    </ng-container>

    <!-- ── CENTER: Main content ───────────────────────── -->
    <div class="tr-list-col">

      <!-- ────── JOURNAL GÉNÉRAL ────── -->
      <ng-container *ngIf="activeTab === 'journal'">
        <div class="tr-list-toolbar">
          <div class="tr-search">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input class="tr-search__input" type="text" [(ngModel)]="searchJournal" placeholder="Rechercher dans le journal…">
          </div>
          <button class="tr-adv-btn" type="button">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filtres avancés
          </button>
        </div>

        <div class="tr-journal-wrap">
          <table class="tr-journal-table">
            <thead>
              <tr>
                <th>DATE / HEURE</th>
                <th>ACTEUR</th>
                <th>ZONE / URD</th>
                <th>MODULE</th>
                <th>ACTION</th>
                <th>ÉLÉMENT</th>
                <th>RÉSULTAT / IMPACT</th>
                <th>TYPE</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let e of filteredJournal()" class="tr-journal-row"
                  [class.tr-journal-row--sel]="selectedJournal === e" (click)="selectJournal(e)">
                <td class="tr-journal-ts">{{ e.timestamp }}</td>
                <td>
                  <div class="tr-journal-user">
                    <div class="tr-journal-avatar">{{ e.user[0] }}</div>
                    <div>
                      <div class="tr-journal-name">{{ e.user }}</div>
                      <div class="tr-journal-role muted">{{ e.role }}</div>
                    </div>
                  </div>
                </td>
                <td><span class="tr-zone-badge">{{ e.zone }}</span></td>
                <td class="muted">{{ e.module }}</td>
                <td class="tr-journal-action">{{ e.action }}</td>
                <td class="tr-journal-element">{{ e.element }}</td>
                <td>
                  <div class="tr-journal-result">
                    <span class="tr-impact-dot tr-impact-dot--{{ e.impact }}"></span>
                    <span class="tr-journal-result__txt">{{ e.result }}</span>
                  </div>
                  <span *ngIf="e.motif" class="tr-journal-motif">Motif : {{ e.motif }}</span>
                </td>
                <td>
                  <span class="tr-journal-type tr-journal-type--{{ e.type }}">{{ journalTypeLabel(e.type) }}</span>
                </td>
              </tr>
              <tr *ngIf="filteredJournal().length === 0">
                <td colspan="8" class="tr-journal-empty">Aucun événement ne correspond aux filtres.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>

      <!-- ────── INTERVENTIONS ────── -->
      <ng-container *ngIf="activeTab === 'interventions'">
        <div class="tr-list-toolbar">
          <div class="tr-search">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input class="tr-search__input" type="text" [(ngModel)]="searchInterv" placeholder="Rechercher une intervention…">
          </div>
          <button class="tr-adv-btn" type="button">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filtres avancés
          </button>
          <button class="tr-adv-btn" type="button" style="margin-left:auto">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          </button>
        </div>

        <!-- List header -->
        <div class="tr-ilist-head">
          <span></span>
          <span>INTERVENTION</span>
          <span>STATUT</span>
          <span>PROGRESSION</span>
          <span>DÉMARRÉE LE</span>
          <span>COMMUNE</span>
          <span></span>
        </div>

        <!-- Intervention cards -->
        <div class="tr-ilist-body">
          <div class="tr-icard"
            *ngFor="let i of filteredInterventions()"
            (click)="selectIntervention(i.id)"
            [class.tr-icard--selected]="selectedId === i.id">

            <div class="tr-icard__icon tr-icard__icon--{{ infraIcon(i.infrastructure) }}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
                <ng-container *ngIf="infraIcon(i.infrastructure) === 'reservoir'">
                  <path d="M2 20h20M4 20V8l8-6 8 6v12"/>
                  <rect x="9" y="14" width="6" height="6"/>
                </ng-container>
                <ng-container *ngIf="infraIcon(i.infrastructure) === 'point'">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </ng-container>
                <ng-container *ngIf="infraIcon(i.infrastructure) === 'sensor'">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                  <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                  <circle cx="12" cy="20" r="1"/>
                </ng-container>
                <ng-container *ngIf="infraIcon(i.infrastructure) === 'pump'">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 9v-2M12 17v2M9 12H7M17 12h-2M10.05 10.05l-1.4-1.4M15.35 15.35l-1.4-1.4M10.05 13.95l-1.4 1.4M15.35 8.65l-1.4 1.4"/>
                </ng-container>
                <ng-container *ngIf="infraIcon(i.infrastructure) === 'station'">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </ng-container>
              </svg>
            </div>

            <div class="tr-icard__main">
              <span class="tr-icard__id">{{ i.id }}</span>
              <span class="tr-icard__infra">{{ i.infrastructure }}</span>
            </div>

            <div class="tr-icard__status">
              <span class="tr-status tr-status--{{ i.status }}">
                <span class="tr-status__dot"></span>
                {{ statusLabel(i.status) }}
              </span>
            </div>

            <div class="tr-icard__prog">
              <div class="tr-prog-bar">
                <div class="tr-prog-fill"
                  [class.tr-prog-fill--done]="i.status === 'terminee' || i.status === 'cloturee'"
                  [style.width.%]="taskProgress(i)"></div>
              </div>
              <span class="tr-prog-label">{{ doneTasks(i) }}/{{ i.tasks.length }} tâches</span>
            </div>

            <div class="tr-icard__date">
              <span>{{ i.startedDate }}</span>
              <span class="muted" style="font-size:.72rem">{{ i.startedAt }}</span>
            </div>

            <div class="tr-icard__commune">{{ i.commune }}</div>

            <div class="tr-icard__menu" (click)="$event.stopPropagation()">
              <button class="tr-icon-btn" type="button">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
              </button>
            </div>

          </div>

          <div class="tr-empty" *ngIf="filteredInterventions().length === 0">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            <p>Aucune intervention ne correspond aux filtres.</p>
          </div>
        </div>

        <!-- Activity log for selected intervention -->
        <ng-container *ngIf="selectedIntervention() as si">
          <div class="tr-activity">
            <div class="tr-activity__title">Activité récente de {{ si.id }}</div>
            <div class="tr-act-item" *ngFor="let e of si.activityLog">
              <div class="tr-act-dot tr-act-dot--{{ e.type }}">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <ng-container *ngIf="e.type === 'photo'"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></ng-container>
                  <ng-container *ngIf="e.type === 'measure'"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></ng-container>
                  <ng-container *ngIf="e.type === 'anomaly'"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></ng-container>
                  <ng-container *ngIf="e.type === 'start'"><polygon points="5 3 19 12 5 21 5 3"/></ng-container>
                  <ng-container *ngIf="e.type === 'task'"><polyline points="20 6 9 17 4 12"/></ng-container>
                  <ng-container *ngIf="e.type === 'note'"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></ng-container>
                </svg>
              </div>
              <div class="tr-act-body">
                <div class="tr-act-label">{{ e.label }}</div>
                <div class="tr-act-meta">
                  <span>{{ e.timestamp }}</span>
                  <span>par {{ e.author }}</span>
                  <span class="tr-act-badge tr-act-badge--anomaly" *ngIf="e.detail">{{ e.detail }}</span>
                </div>
              </div>
              <div class="tr-act-photo" *ngIf="e.type === 'photo'">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
            </div>
            <button class="tr-see-all" type="button">
              Voir tout le journal de cette intervention
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </ng-container>
      </ng-container>

      <!-- ────── ANOMALIES ────── -->
      <ng-container *ngIf="activeTab === 'anomalies'">
        <div class="tr-list-toolbar">
          <div class="tr-search">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input class="tr-search__input" type="text" [(ngModel)]="searchAnomaly" placeholder="Rechercher une anomalie…">
          </div>
        </div>

        <div class="tr-ilist-head tr-ilist-head--ano">
          <span>ANOMALIE</span>
          <span>SOURCE</span>
          <span>INFRASTRUCTURE</span>
          <span>GRAVITÉ</span>
          <span>STATUT</span>
          <span>DATE</span>
          <span>INTERVENTION</span>
        </div>

        <div class="tr-ilist-body">
          <div class="tr-ano-row" *ngFor="let a of filteredAnomalies()">
            <div class="tr-ano-row__id">
              <span class="tr-ano-row__code">{{ a.id }}</span>
              <span class="tr-ano-row__label">{{ a.label }}</span>
            </div>
            <div class="tr-ano-row__source muted">{{ a.source }}</div>
            <div class="tr-ano-row__infra">{{ a.infrastructure }}</div>
            <div>
              <span class="tr-sev tr-sev--{{ a.severity }}">{{ a.severity === 'critique' ? 'Critique' : a.severity.charAt(0).toUpperCase() + a.severity.slice(1) }}</span>
            </div>
            <div>
              <span class="tr-status tr-status--{{ a.status === 'ouverte' ? 'en_cours' : a.status === 'en_cours' ? 'a_verifier' : 'terminee' }}">
                {{ a.status === 'ouverte' ? 'Ouverte' : a.status === 'en_cours' ? 'En cours' : 'Résolue' }}
              </span>
            </div>
            <div class="tr-ano-row__date muted">{{ a.date }}</div>
            <div class="tr-ano-row__int">
              <span *ngIf="a.intervention" class="tr-int-link" (click)="goToIntervention(a.intervention!)">{{ a.intervention }}</span>
              <span *ngIf="!a.intervention" class="muted">—</span>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ────── RAPPORTS (suivi du cycle A4) ────── -->
      <ng-container *ngIf="activeTab === 'rapports'">
        <div class="tr-list-toolbar">
          <div class="tr-search">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input class="tr-search__input" type="text" [(ngModel)]="searchReport" placeholder="Rechercher un rapport (réf, zone)…">
          </div>
        </div>

        <div class="tr-ilist-head tr-ilist-head--rpt">
          <span>RÉFÉRENCE</span>
          <span>ZONE / URD</span>
          <span>DERNIÈRE ÉTAPE</span>
          <span>STATUT</span>
          <span>MÀJ</span>
          <span>ÉTAPES</span>
        </div>

        <div class="tr-ilist-body">
          <div class="tr-rpt-row" *ngFor="let r of filteredReports()"
               [class.tr-rpt-row--sel]="selectedReport === r.ref" (click)="selectReport(r.ref)">
            <div class="tr-rpt-row__ref">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {{ r.ref }}
            </div>
            <div><span class="tr-zone-badge">{{ r.zone }}</span></div>
            <div class="tr-rpt-row__step">{{ r.last.action }}</div>
            <div><span class="tr-rpt-status tr-rpt-status--{{ r.last.type }}">{{ reportStatusLabel(r.last.type) }}</span></div>
            <div class="tr-rpt-row__date muted">{{ r.last.timestamp }}</div>
            <div class="tr-rpt-row__steps">{{ r.steps.length }} étape{{ r.steps.length > 1 ? 's' : '' }}</div>
          </div>
          <div class="tr-empty" *ngIf="filteredReports().length === 0">
            <p>Aucun rapport suivi pour ce filtre.</p>
          </div>
        </div>
      </ng-container>

      <!-- ────── VALIDATIONS & SIGNATURES (timeline du circuit) ────── -->
      <ng-container *ngIf="activeTab === 'validations'">
        <div class="tr-val-intro">
          Circuit officiel de chaque rapport : soumission technicien → validation URD → signature DINEPA → archivage.
          Un renvoi affiche son motif — la preuve reste tracée de bout en bout.
        </div>
        <div class="tr-val-list">
          <div class="tr-val-card" *ngFor="let r of reportsTracked()">
            <div class="tr-val-card__head">
              <span class="tr-val-card__ref">{{ r.ref }}</span>
              <span class="tr-zone-badge">{{ r.zone }}</span>
              <span class="tr-rpt-status tr-rpt-status--{{ r.last.type }}" style="margin-left:auto">{{ reportStatusLabel(r.last.type) }}</span>
            </div>
            <div class="tr-timeline">
              <div class="tr-tl-step" *ngFor="let s of r.steps">
                <div class="tr-tl-marker tr-tl-marker--{{ s.type }}"></div>
                <div class="tr-tl-body">
                  <div class="tr-tl-action">{{ s.action }}</div>
                  <div class="tr-tl-meta">{{ s.timestamp }} · {{ s.user }} <span class="muted">({{ s.role }})</span></div>
                  <div class="tr-tl-motif" *ngIf="s.motif">⚠ Motif : {{ s.motif }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="tr-empty" *ngIf="reportsTracked().length === 0"><p>Aucune validation enregistrée.</p></div>
        </div>
      </ng-container>

      <!-- ────── EXPORTS ────── -->
      <ng-container *ngIf="activeTab === 'exports'">
        <div class="tr-exports-grid">
          <div class="tr-export-card">
            <div class="tr-export-card__icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <h3 class="tr-export-card__title">Journal d'audit complet</h3>
            <p class="tr-export-card__desc">Exportez l'intégralité du journal d'audit en CSV ou PDF.</p>
            <div class="tr-export-card__actions">
              <button class="tr-btn tr-btn--ghost" type="button" style="font-size:.75rem" (click)="toast.push('info', 'Export CSV en cours de préparation…')">CSV</button>
              <button class="tr-btn tr-btn--ghost" type="button" style="font-size:.75rem" (click)="toast.push('info', 'Export PDF en cours de préparation…')">PDF</button>
            </div>
          </div>
          <div class="tr-export-card">
            <div class="tr-export-card__icon tr-export-card__icon--green">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <h3 class="tr-export-card__title">Rapport d'interventions</h3>
            <p class="tr-export-card__desc">Synthèse des interventions, tâches et anomalies sur la période.</p>
            <div class="tr-export-card__actions">
              <button class="tr-btn tr-btn--ghost" type="button" style="font-size:.75rem" (click)="toast.push('info', 'Export CSV en cours de préparation…')">CSV</button>
              <button class="tr-btn tr-btn--ghost" type="button" style="font-size:.75rem" (click)="toast.push('info', 'Export PDF en cours de préparation…')">PDF</button>
            </div>
          </div>
          <div class="tr-export-card">
            <div class="tr-export-card__icon tr-export-card__icon--orange">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01"/></svg>
            </div>
            <h3 class="tr-export-card__title">Rapport d'anomalies</h3>
            <p class="tr-export-card__desc">Liste des anomalies détectées, leur source et leur résolution.</p>
            <div class="tr-export-card__actions">
              <button class="tr-btn tr-btn--ghost" type="button" style="font-size:.75rem" (click)="toast.push('info', 'Export CSV en cours de préparation…')">CSV</button>
              <button class="tr-btn tr-btn--ghost" type="button" style="font-size:.75rem" (click)="toast.push('info', 'Export PDF en cours de préparation…')">PDF</button>
            </div>
          </div>
        </div>
      </ng-container>

    </div>

    <!-- ── RIGHT: Detail panel ─────────────────────────── -->
    <div class="tr-detail-col" *ngIf="activeTab === 'interventions'">

      <!-- No selection -->
      <div class="tr-no-sel" *ngIf="!selectedId">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        <p class="tr-no-sel__title">Sélectionnez une intervention</p>
        <p class="tr-no-sel__sub">Cliquez sur une intervention pour afficher son détail, ses tâches, mesures et preuves terrain.</p>
      </div>

      <!-- Detail panel -->
      <ng-container *ngIf="selectedIntervention() as si">
        <div class="tr-detail">

          <!-- Head -->
          <div class="tr-detail__head">
            <div class="tr-detail__head-top">
              <div class="tr-detail__head-icon tr-detail__head-icon--{{ infraIcon(si.infrastructure) }}">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
                  <ng-container *ngIf="infraIcon(si.infrastructure) === 'reservoir'"><path d="M2 20h20M4 20V8l8-6 8 6v12"/><rect x="9" y="14" width="6" height="6"/></ng-container>
                  <ng-container *ngIf="infraIcon(si.infrastructure) === 'point'"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></ng-container>
                  <ng-container *ngIf="infraIcon(si.infrastructure) === 'sensor'"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></ng-container>
                  <ng-container *ngIf="infraIcon(si.infrastructure) === 'pump'"><circle cx="12" cy="12" r="3"/><path d="M12 9v-2M12 17v2M9 12H7M17 12h-2M10.05 10.05l-1.4-1.4M15.35 15.35l-1.4-1.4M10.05 13.95l-1.4 1.4M15.35 8.65l-1.4 1.4"/></ng-container>
                  <ng-container *ngIf="infraIcon(si.infrastructure) === 'station'"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></ng-container>
                </svg>
              </div>
              <div class="tr-detail__head-text">
                <div class="tr-detail__head-id">{{ si.id }}</div>
                <div class="tr-detail__head-infra">{{ si.infrastructure }} · {{ si.commune }}</div>
              </div>
              <button class="tr-detail__close" (click)="closeDetail()" type="button">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="tr-detail__head-badges">
              <span class="tr-status tr-status--{{ si.status }}">{{ statusLabel(si.status) }}</span>
              <span class="tr-prio tr-prio--{{ si.priority }}">Priorité {{ si.priority }}</span>
            </div>
          </div>

          <!-- Tabs -->
          <div class="tr-detail__tabs">
            <button class="tr-dtab" [class.tr-dtab--active]="detailTab === 'resume'" (click)="detailTab = 'resume'" type="button">Résumé</button>
            <button class="tr-dtab" [class.tr-dtab--active]="detailTab === 'taches'" (click)="detailTab = 'taches'" type="button">Tâches</button>
            <button class="tr-dtab" [class.tr-dtab--active]="detailTab === 'mesures'" (click)="detailTab = 'mesures'" type="button">Mesures</button>
            <button class="tr-dtab" [class.tr-dtab--active]="detailTab === 'anomalies'" (click)="detailTab = 'anomalies'" type="button">Anomalies</button>
            <button class="tr-dtab" [class.tr-dtab--active]="detailTab === 'preuves'" (click)="detailTab = 'preuves'" type="button">Preuves</button>
          </div>

          <!-- Body -->
          <div class="tr-detail__body">

            <!-- RÉSUMÉ -->
            <ng-container *ngIf="detailTab === 'resume'">
              <div class="tr-detail__section">
                <div class="tr-detail__section-title">Informations générales</div>
                <div class="tr-drow"><span class="tr-drow__k">Code</span><span class="tr-drow__v">{{ si.id }}</span></div>
                <div class="tr-drow"><span class="tr-drow__k">Type</span><span class="tr-drow__v">{{ si.type }}</span></div>
                <div class="tr-drow"><span class="tr-drow__k">Infrastructure</span><span class="tr-drow__v">{{ si.infrastructure }}</span></div>
                <div class="tr-drow"><span class="tr-drow__k">Commune</span><span class="tr-drow__v">{{ si.commune }}</span></div>
                <div class="tr-drow"><span class="tr-drow__k">Département</span><span class="tr-drow__v">{{ si.department }}</span></div>
                <div class="tr-drow"><span class="tr-drow__k">Déclenchée par</span><span class="tr-drow__v">{{ si.triggerSource }}</span></div>
                <div class="tr-drow"><span class="tr-drow__k">Démarrée le</span><span class="tr-drow__v">{{ si.startedDate }} à {{ si.startedAt }}</span></div>
              </div>
              <div class="tr-detail__section">
                <div class="tr-detail__section-title">Responsabilité</div>
                <div class="tr-drow"><span class="tr-drow__k">Responsable</span><span class="tr-drow__v">{{ si.responsable }}</span></div>
                <div class="tr-drow"><span class="tr-drow__k">Technicien</span><span class="tr-drow__v">{{ si.technicien }}</span></div>
                <div class="tr-drow"><span class="tr-drow__k">Priorité</span>
                  <span class="tr-drow__v"><span class="tr-prio tr-prio--{{ si.priority }}">{{ si.priority.charAt(0).toUpperCase() + si.priority.slice(1) }}</span></span>
                </div>
                <div class="tr-drow"><span class="tr-drow__k">Statut</span>
                  <span class="tr-drow__v"><span class="tr-status tr-status--{{ si.status }}">{{ statusLabel(si.status) }}</span></span>
                </div>
              </div>
              <div class="tr-detail__section">
                <div class="tr-detail__section-title">Progression</div>
                <div class="tr-detail-prog">
                  <div class="tr-detail-prog__label">
                    <span class="tr-detail-prog__count">{{ doneTasks(si) }}/{{ si.tasks.length }} tâches terminées</span>
                    <span class="tr-detail-prog__pct">{{ taskProgress(si) }} %</span>
                  </div>
                  <div class="tr-detail-prog__bar">
                    <div class="tr-detail-prog__fill"
                      [class.tr-detail-prog__fill--done]="taskProgress(si) === 100"
                      [style.width.%]="taskProgress(si)"></div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- TÂCHES -->
            <ng-container *ngIf="detailTab === 'taches'">
              <div class="tr-detail__section">
                <div class="tr-detail-prog" style="margin-bottom:.75rem">
                  <div class="tr-detail-prog__label">
                    <span class="tr-detail-prog__count">{{ doneTasks(si) }}/{{ si.tasks.length }} tâches terminées</span>
                    <span class="tr-detail-prog__pct">{{ taskProgress(si) }} %</span>
                  </div>
                  <div class="tr-detail-prog__bar">
                    <div class="tr-detail-prog__fill"
                      [class.tr-detail-prog__fill--done]="taskProgress(si) === 100"
                      [style.width.%]="taskProgress(si)"></div>
                  </div>
                </div>
                <div class="tr-tasks">
                  <div class="tr-task" *ngFor="let t of si.tasks">
                    <div class="tr-task__check" [class.tr-task__check--done]="t.done">
                      <svg *ngIf="t.done" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <span class="tr-task__label" [class.tr-task__label--done]="t.done">{{ t.label }}</span>
                  </div>
                </div>
              </div>

              <div class="tr-detail__section" *ngIf="si.measures.length > 0">
                <div class="tr-detail__section-title">Mesures clés <span class="muted" style="font-weight:400;text-transform:none;font-size:.7rem">(dernière relevée)</span></div>
                <div class="tr-measures">
                  <div class="tr-measure-card" *ngFor="let m of si.measures">
                    <span class="tr-measure-card__label">{{ m.label }}</span>
                    <span class="tr-measure-card__val">{{ m.value }}</span>
                    <span class="tr-measure-card__unit">{{ m.unit }}</span>
                  </div>
                </div>
              </div>

              <div class="tr-detail__section">
                <div class="tr-detail__section-title" style="display:flex;align-items:center;justify-content:space-between">
                  Anomalies
                  <button class="tr-btn-link" type="button" (click)="notifySignalement()">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Signaler une anomalie
                  </button>
                </div>
                <div *ngIf="si.anomalies.length === 0" class="muted" style="font-size:.8rem;padding:.4rem 0">Aucune anomalie signalée.</div>
                <div class="tr-ano-list" *ngIf="si.anomalies.length > 0">
                  <div class="tr-ano-item" *ngFor="let a of si.anomalies">
                    <div class="tr-ano-item__icon tr-ano-item__icon--{{ a.severity }}">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01"/></svg>
                    </div>
                    <div class="tr-ano-item__body">
                      <div class="tr-ano-item__label">{{ a.label }}</div>
                      <div class="tr-ano-item__meta">
                        <span class="tr-sev tr-sev--{{ a.severity }}">{{ a.severity.charAt(0).toUpperCase() + a.severity.slice(1) }} priorité</span>
                        <span class="muted">· {{ a.date }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="tr-detail__section">
                <div class="tr-detail__section-title">Preuves terrain</div>
                <div class="tr-proofs">
                  <div class="tr-proof-card" *ngFor="let p of photosArray(si.photos)">
                    <div class="tr-proof-card__img">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </div>
                  </div>
                  <div class="tr-proof-add" (click)="toast.push('info', 'Ajout de preuve — Fonctionnalité disponible prochainement')">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Ajouter une preuve
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- MESURES -->
            <ng-container *ngIf="detailTab === 'mesures'">
              <div class="tr-detail__section">
                <div class="tr-detail__section-title">Dernières mesures relevées</div>
                <div class="tr-measures" style="grid-template-columns:repeat(2,1fr)">
                  <div class="tr-measure-card" *ngFor="let m of si.measures">
                    <span class="tr-measure-card__label">{{ m.label }}</span>
                    <span class="tr-measure-card__val">{{ m.value }}</span>
                    <span class="tr-measure-card__unit">{{ m.unit }}</span>
                  </div>
                </div>
              </div>
              <div class="tr-detail__section">
                <div class="tr-detail__section-title">Historique des relevés</div>
                <div class="muted" style="font-size:.8rem;padding:.5rem 0;line-height:1.6">
                  Les mesures seront enregistrées automatiquement à chaque validation de tâche par le technicien.
                  L'historique complet est disponible dans la section Historique.
                </div>
              </div>
            </ng-container>

            <!-- ANOMALIES -->
            <ng-container *ngIf="detailTab === 'anomalies'">
              <div class="tr-detail__section">
                <div class="tr-detail__section-title" style="display:flex;align-items:center;justify-content:space-between">
                  Anomalies ({{ si.anomalies.length }})
                  <button class="tr-btn-link" type="button" (click)="notifySignalement()">
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Signaler
                  </button>
                </div>
                <div *ngIf="si.anomalies.length === 0" class="muted" style="font-size:.8rem;padding:.4rem 0">Aucune anomalie signalée pour cette intervention.</div>
                <div class="tr-ano-list" *ngIf="si.anomalies.length > 0">
                  <div class="tr-ano-item" *ngFor="let a of si.anomalies">
                    <div class="tr-ano-item__icon tr-ano-item__icon--{{ a.severity }}">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01"/></svg>
                    </div>
                    <div class="tr-ano-item__body">
                      <div class="tr-ano-item__label">{{ a.label }}</div>
                      <div class="tr-ano-item__meta">
                        <span class="tr-sev tr-sev--{{ a.severity }}">{{ a.severity.charAt(0).toUpperCase() + a.severity.slice(1) }} priorité</span>
                        <span class="muted">· Signalée {{ a.date }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- PREUVES -->
            <ng-container *ngIf="detailTab === 'preuves'">
              <div class="tr-detail__section">
                <div class="tr-detail__section-title">Photos et documents ({{ si.photos }})</div>
                <div class="tr-proofs" style="grid-template-columns:repeat(2,1fr)">
                  <div class="tr-proof-card" *ngFor="let p of photosArray(si.photos)" style="aspect-ratio:16/10">
                    <div class="tr-proof-card__img">
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    </div>
                  </div>
                  <div class="tr-proof-add" style="aspect-ratio:16/10" (click)="toast.push('info', 'Ajout de preuve — Fonctionnalité disponible prochainement')">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Photo, document ou note
                  </div>
                </div>
              </div>
            </ng-container>

          </div><!-- tr-detail__body -->

          <!-- Footer actions -->
          <div class="tr-detail__footer">
            <div class="tr-detail__footer-actions">
              <button class="tr-btn-validate" type="button" (click)="toast.push('info', 'Validation du rapport — Fonctionnalité disponible prochainement')">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Valider le rapport
              </button>
              <button class="tr-btn-close" type="button" (click)="clotureIntervention(si.id)">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Clôturer l'intervention
              </button>
            </div>
          </div>

        </div>
      </ng-container>
    </div>

    <!-- ── RIGHT: Journal proof panel (clic sur une ligne) ── -->
    <div class="tr-detail-col" *ngIf="(activeTab === 'journal' || activeTab === 'rapports' || activeTab === 'validations') && selectedJournal as e">
      <div class="tr-detail">
        <div class="tr-detail__head">
          <div class="tr-detail__head-top">
            <div class="tr-detail__head-icon tr-detail__head-icon--reservoir">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.66 0 3.22.45 4.56 1.24"/></svg>
            </div>
            <div class="tr-detail__head-text">
              <div class="tr-detail__head-id">{{ e.action }}</div>
              <div class="tr-detail__head-infra">Preuve de l'événement · {{ e.element }}</div>
            </div>
            <button class="tr-detail__close" (click)="selectedJournal = null" type="button">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="tr-detail__head-badges">
            <span class="tr-journal-type tr-journal-type--{{ e.type }}">{{ journalTypeLabel(e.type) }}</span>
            <span class="tr-impact-badge tr-impact-badge--{{ e.impact }}">Impact {{ impactLabel(e.impact) }}</span>
          </div>
        </div>
        <div class="tr-detail__body">
          <div class="tr-detail__section">
            <div class="tr-detail__section-title">Qui · Où · Quand</div>
            <div class="tr-drow"><span class="tr-drow__k">Acteur</span><span class="tr-drow__v">{{ e.user }}</span></div>
            <div class="tr-drow"><span class="tr-drow__k">Rôle</span><span class="tr-drow__v">{{ e.role }}</span></div>
            <div class="tr-drow"><span class="tr-drow__k">Zone / URD</span><span class="tr-drow__v">{{ e.zone }}</span></div>
            <div class="tr-drow"><span class="tr-drow__k">Module</span><span class="tr-drow__v">{{ e.module }}</span></div>
            <div class="tr-drow"><span class="tr-drow__k">Horodatage</span><span class="tr-drow__v">{{ e.timestamp }}</span></div>
          </div>
          <div class="tr-detail__section">
            <div class="tr-detail__section-title">Objet &amp; résultat</div>
            <div class="tr-drow"><span class="tr-drow__k">Élément concerné</span><span class="tr-drow__v">{{ e.element }}</span></div>
            <div class="tr-drow"><span class="tr-drow__k">Résultat</span><span class="tr-drow__v">{{ e.result }}</span></div>
            <div class="tr-drow" *ngIf="e.oldValue"><span class="tr-drow__k">Ancienne valeur</span><span class="tr-drow__v">{{ e.oldValue }}</span></div>
            <div class="tr-drow" *ngIf="e.newValue"><span class="tr-drow__k">Nouvelle valeur</span><span class="tr-drow__v">{{ e.newValue }}</span></div>
          </div>
          <div class="tr-detail__section" *ngIf="e.motif">
            <div class="tr-detail__section-title">Motif</div>
            <div class="tr-detail-motif">{{ e.motif }}</div>
          </div>
          <div class="tr-detail__section" *ngIf="e.linkedReport || e.linkedIntervention">
            <div class="tr-detail__section-title">Preuves &amp; liens</div>
            <button *ngIf="e.linkedReport" class="tr-link-chip" type="button" (click)="toast.push('info', 'Ouverture du rapport ' + e.linkedReport + ' — aperçu A4')">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Rapport {{ e.linkedReport }}
            </button>
            <button *ngIf="e.linkedIntervention" class="tr-link-chip" type="button" (click)="goToIntervention(e.linkedIntervention!)">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              {{ e.linkedIntervention }}
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</div>
  `,
  styles: [`
    /* KPI strip */
    .tr-kpis { display:grid; grid-template-columns:repeat(6,1fr); gap:.6rem; padding:.9rem 1.5rem; border-bottom:1px solid var(--border-color); flex-shrink:0; }
    .tr-kpi { text-align:left; background:var(--surface); border:1px solid var(--border-color); border-radius:11px; padding:.7rem .8rem; cursor:pointer; display:flex; flex-direction:column; gap:.15rem; transition:border-color .15s, box-shadow .15s; }
    .tr-kpi:hover { border-color:color-mix(in srgb, var(--primary) 40%, var(--border)); }
    .tr-kpi--on { border-color:var(--primary); box-shadow:0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent); }
    .tr-kpi__val { font-size:1.5rem; font-weight:800; color:var(--text); line-height:1; }
    .tr-kpi__lbl { font-size:.71rem; color:var(--muted); font-weight:500; line-height:1.25; }
    .tr-kpi--primary .tr-kpi__val { color:var(--primary); }
    .tr-kpi--warn .tr-kpi__val { color:var(--warning); }
    .tr-kpi--success .tr-kpi__val { color:var(--success); }

    /* Header button nuance */
    .tr-btn--subtle { color:var(--muted); }

    /* Zone / URD badge */
    .tr-zone-badge { display:inline-flex; align-items:center; font-size:.71rem; font-weight:600; color:var(--text); background:color-mix(in srgb, var(--primary) 9%, transparent); border:1px solid color-mix(in srgb, var(--primary) 22%, transparent); border-radius:6px; padding:.12rem .45rem; white-space:nowrap; }

    /* Journal rows — clickable + contrast + résultat/impact */
    .tr-journal-row { cursor:pointer; }
    .tr-journal-row:hover td { background:color-mix(in srgb, var(--primary) 5%, transparent); }
    .tr-journal-row--sel td { background:color-mix(in srgb, var(--primary) 9%, transparent); }
    .tr-journal-result { display:flex; align-items:center; gap:.4rem; }
    .tr-journal-result__txt { color:var(--text); font-size:.78rem; }
    .tr-journal-motif { display:block; font-size:.71rem; color:var(--warning); margin-top:.15rem; font-style:italic; }
    .tr-journal-empty { text-align:center; color:var(--muted); font-size:.8rem; padding:1.5rem; }
    .tr-impact-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .tr-impact-dot--critique { background:#dc2626; }
    .tr-impact-dot--important { background:#ea580c; }
    .tr-impact-dot--normal { background:#64748b; }
    .tr-impact-dot--info { background:#2563eb; }
    .tr-impact-badge { font-size:.69rem; font-weight:700; padding:.14rem .45rem; border-radius:20px; }
    .tr-impact-badge--critique { background:#fef2f2; color:#dc2626; }
    .tr-impact-badge--important { background:#fff7ed; color:#ea580c; }
    .tr-impact-badge--normal { background:#f1f5f9; color:#475569; }
    .tr-impact-badge--info { background:#eff6ff; color:#2563eb; }

    /* Sober workflow type badges (extend the global set) */
    .tr-journal-type--submit  { background:#eff6ff; color:#2563eb; }
    .tr-journal-type--return  { background:#fff7ed; color:#ea580c; }
    .tr-journal-type--sign    { background:#ecfdf5; color:#059669; }
    .tr-journal-type--archive { background:#f1f5f9; color:#475569; }
    .tr-journal-type--export  { background:#f5f3ff; color:#7c3aed; }

    /* Rapports tab table */
    .tr-ilist-head--rpt { grid-template-columns:1.4fr 1.3fr 1.4fr 130px 130px 90px; }
    .tr-rpt-row { display:grid; grid-template-columns:1.4fr 1.3fr 1.4fr 130px 130px 90px; align-items:center; gap:.5rem; padding:.6rem .9rem; border-bottom:1px solid var(--border-color); cursor:pointer; font-size:.79rem; }
    .tr-rpt-row:hover { background:color-mix(in srgb, var(--primary) 5%, transparent); }
    .tr-rpt-row--sel { background:color-mix(in srgb, var(--primary) 9%, transparent); }
    .tr-rpt-row__ref { display:flex; align-items:center; gap:.4rem; font-weight:700; color:var(--text); }
    .tr-rpt-row__ref svg { color:var(--primary); flex-shrink:0; }
    .tr-rpt-row__step { color:var(--text); }
    .tr-rpt-row__date { font-size:.73rem; }
    .tr-rpt-row__steps { color:var(--muted); font-size:.74rem; }
    .tr-rpt-status { display:inline-flex; font-size:.69rem; font-weight:700; padding:.14rem .5rem; border-radius:20px; white-space:nowrap; }
    .tr-rpt-status--submit  { background:#eff6ff; color:#2563eb; }
    .tr-rpt-status--validate{ background:#f0fdf4; color:#16a34a; }
    .tr-rpt-status--return  { background:#fff7ed; color:#ea580c; }
    .tr-rpt-status--sign    { background:#ecfdf5; color:#059669; }
    .tr-rpt-status--archive { background:#f1f5f9; color:#475569; }
    .tr-rpt-status--export  { background:#f5f3ff; color:#7c3aed; }

    /* Validations timeline */
    .tr-val-intro { padding:.85rem 1.1rem; font-size:.78rem; color:var(--muted); line-height:1.55; border-bottom:1px solid var(--border-color); }
    .tr-val-list { flex:1; overflow-y:auto; padding:1rem 1.1rem; display:flex; flex-direction:column; gap:.9rem; }
    .tr-val-card { border:1px solid var(--border-color); border-radius:12px; background:var(--surface); overflow:hidden; }
    .tr-val-card__head { display:flex; align-items:center; gap:.55rem; padding:.7rem .9rem; border-bottom:1px solid var(--border-color); background:var(--bg); }
    .tr-val-card__ref { font-size:.85rem; font-weight:800; color:var(--text); }
    .tr-timeline { padding:.8rem .9rem .8rem 1rem; display:flex; flex-direction:column; }
    .tr-tl-step { display:flex; gap:.75rem; position:relative; padding-bottom:.85rem; }
    .tr-tl-step:not(:last-child)::before { content:''; position:absolute; left:6px; top:14px; bottom:0; width:2px; background:var(--border-color); }
    .tr-tl-step:last-child { padding-bottom:0; }
    .tr-tl-marker { width:14px; height:14px; border-radius:50%; flex-shrink:0; margin-top:2px; border:3px solid var(--surface); box-shadow:0 0 0 1px var(--border-color); z-index:1; }
    .tr-tl-marker--submit  { background:#2563eb; }
    .tr-tl-marker--validate{ background:#16a34a; }
    .tr-tl-marker--return  { background:#ea580c; }
    .tr-tl-marker--sign    { background:#059669; }
    .tr-tl-marker--archive { background:#64748b; }
    .tr-tl-marker--export  { background:#7c3aed; }
    .tr-tl-action { font-size:.8rem; font-weight:600; color:var(--text); }
    .tr-tl-meta { font-size:.72rem; color:var(--muted); margin-top:.1rem; }
    .tr-tl-motif { font-size:.73rem; color:var(--warning); margin-top:.25rem; background:#fff7ed; border:1px solid #fed7aa; border-radius:6px; padding:.3rem .5rem; }

    /* Journal proof panel extras */
    .tr-detail-motif { font-size:.78rem; color:var(--text); line-height:1.55; background:color-mix(in srgb, var(--warning) 10%, transparent); border:1px solid color-mix(in srgb, var(--warning) 30%, transparent); border-radius:8px; padding:.55rem .7rem; }
    .tr-link-chip { display:inline-flex; align-items:center; gap:.4rem; font-size:.76rem; font-weight:600; color:var(--primary); background:color-mix(in srgb, var(--primary) 8%, transparent); border:1px solid color-mix(in srgb, var(--primary) 22%, transparent); border-radius:8px; padding:.4rem .6rem; cursor:pointer; margin:.2rem .35rem 0 0; }
    .tr-link-chip:hover { background:color-mix(in srgb, var(--primary) 15%, transparent); }
  `]
})
export class TraceabilityPageComponent {
  activeTab: TraceTab = 'interventions';
  detailTab: DetailTab = 'taches';
  selectedId?: string;

  filtresOuverts = false;

  filterPeriod = '7d';
  filterDepartment = '';
  filterCommune = '';
  filterModule = '';
  filterActionType = '';
  filterStatus = '';
  filterResponsable = '';
  filterInfra = '';

  searchInterv = '';
  searchJournal = '';
  searchAnomaly = '';
  searchReport = '';

  /** Ligne de journal sélectionnée → panneau de preuve à droite. */
  selectedJournal: JournalEntry | null = null;
  selectedReport?: string;

  readonly interventions = INTERVENTIONS;
  readonly journalEntries = JOURNAL_ENTRIES;
  readonly anomalyRecords = ANOMALY_RECORDS;

  /** Étapes du circuit rapport retenues pour la timeline (l'export reste un événement à part). */
  private readonly REPORT_STEPS: JournalType[] = ['submit', 'return', 'validate', 'sign', 'archive'];

  constructor(readonly toast: ToastService) {}

  setTab(tab: TraceTab): void {
    this.activeTab = tab;
    if (tab !== 'interventions') {
      this.selectedId = undefined;
    }
  }

  selectIntervention(id: string): void {
    this.selectedId = id;
    this.detailTab = 'taches';
  }

  closeDetail(): void {
    this.selectedId = undefined;
  }

  selectedIntervention(): Intervention | undefined {
    if (!this.selectedId) return undefined;
    return this.interventions.find(i => i.id === this.selectedId);
  }

  filteredInterventions(): Intervention[] {
    return this.interventions.filter(i => {
      if (this.filterStatus && i.status !== this.filterStatus) return false;
      if (this.filterDepartment && i.department !== this.filterDepartment) return false;
      if (this.filterCommune && i.commune !== this.filterCommune) return false;
      if (this.filterResponsable && i.responsable !== this.filterResponsable) return false;
      if (this.filterInfra && i.infrastructure !== this.filterInfra) return false;
      if (this.searchInterv.trim()) {
        const q = this.searchInterv.toLowerCase();
        if (!i.id.toLowerCase().includes(q) && !i.infrastructure.toLowerCase().includes(q) && !i.commune.toLowerCase().includes(q) && !i.type.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  filteredJournal(): JournalEntry[] {
    return this.journalEntries.filter(e => {
      if (this.filterModule && e.module !== this.filterModule) return false;
      if (this.filterActionType && e.type !== this.filterActionType) return false;
      if (this.filterDepartment && !e.zone.toLowerCase().includes(this.filterDepartment.toLowerCase())) return false;
      if (this.filterCommune && !e.zone.toLowerCase().includes(this.filterCommune.toLowerCase())) return false;
      if (this.searchJournal.trim()) {
        const q = this.searchJournal.toLowerCase();
        if (![e.user, e.module, e.action, e.element, e.result, e.zone].some(v => v.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }

  // ── Suivi du cycle des rapports A4 ─────────────────────────────────────────
  /** Regroupe les événements de rapport par référence, étapes triées chronologiquement. */
  reportsTracked(): { ref: string; zone: string; steps: JournalEntry[]; last: JournalEntry }[] {
    const groups = new Map<string, JournalEntry[]>();
    for (const e of this.journalEntries) {
      if (!e.linkedReport || !this.REPORT_STEPS.includes(e.type)) continue;
      const arr = groups.get(e.linkedReport) ?? [];
      arr.push(e);
      groups.set(e.linkedReport, arr);
    }
    return [...groups.entries()].map(([ref, steps]) => {
      const sorted = [...steps].sort((a, b) => this.tsKey(a.timestamp) - this.tsKey(b.timestamp));
      return { ref, zone: sorted[0].zone, steps: sorted, last: sorted[sorted.length - 1] };
    }).sort((a, b) => this.tsKey(b.last.timestamp) - this.tsKey(a.last.timestamp));
  }

  filteredReports() {
    const q = this.searchReport.trim().toLowerCase();
    return this.reportsTracked().filter(r => !q || r.ref.toLowerCase().includes(q) || r.zone.toLowerCase().includes(q));
  }

  validationsCount(): number {
    return this.journalEntries.filter(e => e.type === 'validate' || e.type === 'sign').length;
  }
  exportsCount(): number {
    return this.journalEntries.filter(e => e.type === 'export').length;
  }

  selectJournal(e: JournalEntry): void { this.selectedJournal = e; }
  selectReport(ref: string): void {
    this.selectedReport = ref;
    const grp = this.reportsTracked().find(r => r.ref === ref);
    this.selectedJournal = grp ? grp.last : null;
  }

  /** "29/04/2026 11:20" → clé numérique triable. */
  private tsKey(ts: string): number {
    const m = ts.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
    if (!m) return 0;
    const [, d, mo, y, h, mi] = m;
    return +`${y}${mo}${d}${h}${mi}`;
  }

  reportStatusLabel(type: JournalType): string {
    const map: Partial<Record<JournalType, string>> = {
      submit: 'Soumis', validate: 'Validé URD', return: 'Renvoyé',
      sign: 'Signé DINEPA', archive: 'Archivé', export: 'Exporté',
    };
    return map[type] ?? this.journalTypeLabel(type);
  }

  impactLabel(impact: JournalImpact): string {
    return { critique: 'critique', important: 'important', normal: 'normal', info: 'info' }[impact];
  }

  filteredAnomalies(): AnomalyRecord[] {
    return this.anomalyRecords.filter(a => {
      if (this.searchAnomaly.trim()) {
        const q = this.searchAnomaly.toLowerCase();
        if (!a.label.toLowerCase().includes(q) && !a.infrastructure.toLowerCase().includes(q) && !a.id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  countByStatus(status: IntervStatus): number {
    return this.interventions.filter(i => i.status === status).length;
  }

  openAnomaliesCount(): number {
    return this.anomalyRecords.filter(a => a.status === 'ouverte').length;
  }

  doneTasks(i: Intervention): number {
    return i.tasks.filter(t => t.done).length;
  }

  taskProgress(i: Intervention): number {
    if (!i.tasks.length) return 0;
    return Math.round((this.doneTasks(i) / i.tasks.length) * 100);
  }

  photosArray(count: number): number[] {
    return Array.from({ length: count }, (_, k) => k);
  }

  statusLabel(status: IntervStatus): string {
    const map: Record<IntervStatus, string> = {
      en_cours:  'En cours',
      terminee:  'Terminée',
      a_verifier: 'À vérifier',
      planifiee:  'Planifiée',
      cloturee:   'Clôturée',
      rejetee:    'Rejetée',
    };
    return map[status] ?? status;
  }

  infraIcon(infrastructure: string): string {
    const s = infrastructure.toLowerCase();
    if (s.includes('réservoir') || s.includes('reservoir')) return 'reservoir';
    if (s.includes('point') || s.includes('kiosque')) return 'point';
    if (s.includes('capteur') || s.includes('lvl') || s.includes('flow') || s.includes('press')) return 'sensor';
    if (s.includes('pompe')) return 'pump';
    return 'station';
  }

  journalTypeLabel(type: string): string {
    const map: Record<string, string> = {
      create: 'Création',
      update: 'Modification',
      assign: 'Assignation',
      validate: 'Validation',
      delete: 'Suppression',
      submit: 'Soumission',
      return: 'Renvoi',
      sign: 'Signature',
      archive: 'Archivage',
      export: 'Export',
    };
    return map[type] ?? type;
  }

  goToIntervention(id: string): void {
    this.activeTab = 'interventions';
    this.selectedId = id;
    this.detailTab = 'taches';
  }

  resetFilters(): void {
    this.filterPeriod = '7d';
    this.filterDepartment = '';
    this.filterCommune = '';
    this.filterModule = '';
    this.filterActionType = '';
    this.filterStatus = '';
    this.filterResponsable = '';
    this.filterInfra = '';
    this.searchInterv = '';
    this.searchJournal = '';
    this.searchAnomaly = '';
    this.searchReport = '';
  }

  clotureIntervention(id: string): void {
    this.toast.push('info', `Clôture de ${id} — Fonctionnalité disponible prochainement`);
  }

  notifyNouveauSuivi(): void {
    this.toast.push('info', "Ajout d'une note de suivi — Fonctionnalité disponible prochainement");
  }

  notifyAudit(): void {
    this.toast.push('info', "Génération du rapport d'audit — Fonctionnalité disponible prochainement");
  }

  notifySignalement(): void {
    this.toast.push('info', "Signalement d'anomalie — Fonctionnalité disponible prochainement");
  }
}
