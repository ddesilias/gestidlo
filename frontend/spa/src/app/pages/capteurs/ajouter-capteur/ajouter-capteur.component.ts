import {
  ChangeDetectionStrategy, Component, EventEmitter, HostListener, Output, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type CapteurTypeLocal = 'pression' | 'debit' | 'niveau' | 'qualite';
type Protocole = 'MQTT' | 'MQTTs' | 'HTTP' | 'CoAP' | 'UDP';
type Severite  = 'ATTENTION' | 'CRITIQUE' | 'URGENCE';

interface RegleAlerte {
  id: string;
  severite: Severite;
  condition: string;
  seuil: string;
  duree: string;
  sla: string;
}

@Component({
  selector: 'app-ajouter-capteur',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ajouter-capteur.component.html',
  styleUrls: ['./ajouter-capteur.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AjouterCapteurComponent {
  @Output() fermer     = new EventEmitter<void>();
  @Output() enregistre = new EventEmitter<void>();

  // ── Stepper ───────────────────────────────────────────────────────────────
  etapeActive = signal(1);

  readonly ETAPES = [
    { n: 1, label: 'Identification' },
    { n: 2, label: 'Localisation' },
    { n: 3, label: 'Association' },
    { n: 4, label: 'Connectivité' },
    { n: 5, label: 'Calibration' },
    { n: 6, label: 'Seuils' },
  ];

  // ── Section 1 — Identification ────────────────────────────────────────────
  code       = 'CPT-PR-021';
  nom        = '';
  typeMesure = signal<CapteurTypeLocal>('pression');
  modele     = 'Danfoss MBS 3000 · industriel · 0-10 bar';
  numSerie   = '';

  readonly TYPES: { id: CapteurTypeLocal; label: string; sub: string }[] = [
    { id: 'pression', label: 'Pression', sub: 'bar / psi' },
    { id: 'debit',    label: 'Débit',    sub: 'L/min · m³/h' },
    { id: 'niveau',   label: 'Niveau',   sub: '% · cm' },
    { id: 'qualite',  label: 'Qualité',  sub: 'pH · TDS · NTU' },
  ];

  readonly MODELES = [
    'Danfoss MBS 3000 · industriel · 0-10 bar',
    'Dragino PS-NB · NB-IoT immersion · 0-7 bar',
    'Transducteur 0.5-4.5V · analogique · 0-1.2 MPa',
    'YF-S201 · Hall effect · 1-30 L/min (débit)',
    'JSN-SR04T · ultrasonique waterproof (niveau)',
    'Autre — saisie manuelle',
  ];

  // ── Section 2 — Localisation ──────────────────────────────────────────────
  departement = 'Ouest';
  commune     = 'Léogâne';
  section     = 'Dessources';
  lat         = '18.5100';
  lon         = '-72.6300';

  // ── Section 3 — Association ───────────────────────────────────────────────
  infraLiee    = 'Réservoir R-01 · Dessources';
  pointInstall = 'Sortie réservoir · vanne V-12';
  institution  = 'DINEPA Ouest';
  technicien   = 'Jean P. · spécialiste réservoirs';

  // ── Section 4 — Connectivité ──────────────────────────────────────────────
  microcontroleur = 'ESP32 · GDL-GW-001';
  pin             = 'GPIO 34 (ADC analogique)';
  protocole       = signal<Protocole>('MQTT');
  topicMqtt       = 'gestidlo/leogane/dessources/R-01/pression';
  typeReseau      = 'Wi-Fi';
  freqEnvoi       = '30 secondes';
  qosMqtt         = '1 · au moins une fois';

  readonly PROTOCOLES: Protocole[] = ['MQTT', 'MQTTs', 'HTTP', 'CoAP', 'UDP'];

  // ── Section 5 — Calibration ───────────────────────────────────────────────
  plageMin          = '0';
  plageMax          = '10';
  uniteRange        = 'bar';
  precision         = '±0.5%';
  tensionEntree     = '0.5 - 4.5 V';
  formuleConversion = 'P = (V - 0.5) × 2.5';
  offset            = '0.0';
  valeurMesuree     = '0.8 bar';
  valeurReference   = '1.0';
  correction        = '+0.2 bar';

  // ── Section 6 — Seuils ────────────────────────────────────────────────────
  regles = signal<RegleAlerte[]>([
    { id: '1', severite: 'ATTENTION', condition: '< inférieur à', seuil: '1.5', duree: '5 min',    sla: '4h'    },
    { id: '2', severite: 'CRITIQUE',  condition: '< inférieur à', seuil: '1.0', duree: '2 min',    sla: '2h'    },
    { id: '3', severite: 'URGENCE',   condition: '< inférieur à', seuil: '0.5', duree: 'immédiat', sla: '30min' },
  ]);
  alerteHorsLigne = true;
  alerteBatterie  = true;
  notifTechnicien = false;

  // ── Actions ────────────────────────────────────────────────────────────────
  setType(t: CapteurTypeLocal): void  { this.typeMesure.set(t); }
  setProtocole(p: Protocole): void    { this.protocole.set(p); }
  setEtape(n: number): void           { this.etapeActive.set(n); }
  etapePrecedente(): void             { if (this.etapeActive() > 1) this.etapeActive.update(n => n - 1); }
  etapeSuivante(): void               { if (this.etapeActive() < this.ETAPES.length) this.etapeActive.update(n => n + 1); }
  estDerniereEtape(): boolean         { return this.etapeActive() === this.ETAPES.length; }

  supprimerRegle(id: string): void {
    this.regles.update(r => r.filter(x => x.id !== id));
  }

  ajouterRegle(): void {
    this.regles.update(r => [
      ...r,
      { id: Date.now().toString(), severite: 'ATTENTION', condition: '< inférieur à', seuil: '', duree: '', sla: '' },
    ]);
  }

  onEnregistrer(): void { this.enregistre.emit(); this.fermer.emit(); }

  severiteCls(s: Severite): string {
    return { ATTENTION: 'ac-sev--att', CRITIQUE: 'ac-sev--crit', URGENCE: 'ac-sev--urg' }[s];
  }

  @HostListener('keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') this.fermer.emit();
  }
}
