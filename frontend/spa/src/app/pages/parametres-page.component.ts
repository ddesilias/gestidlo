import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { ToastService } from '../ui/toast.service';

/**
 * PARAMÈTRES SYSTÈME · v2 — centre de configuration officiel de GEstiDlo.
 *
 * Layout 3 colonnes fidèle au wireframe : nav DOMAINES · sections empilées · rail
 * « Impact » (propagation + aperçu jauge + ancres de section). Portée par rôle
 * (Admin/URD/Technicien), barre d'enregistrement avec suivi des modifications,
 * jauge interactive pour le seuil critique de pression. Palette sombre dédiée.
 *
 * Présentationnel (comme le wireframe) : les référentiels réellement éditables
 * (mesures, types de points, seuils) exposent un lien « éditeur réel ».
 */

type Role = 'A' | 'U' | 'T';
type Cell = string | { tgl: boolean } | { crit: true };

interface Field { l: string; v?: string; sel?: string[]; ro?: boolean; hint?: string; full?: boolean; toggle?: boolean; on?: boolean; tdesc?: string; swatch?: boolean; }
interface Section {
  id: string; icon: string; title: string; desc: string; roles: string; usedIn: string[];
  type: 'form' | 'table' | 'pills' | 'matrix' | 'workflow';
  fields?: Field[]; cols?: string[]; rows?: Cell[][]; pills?: [string, string][]; steps?: [string, string, string][];
  preview?: 'gauge'; link?: { label: string; path: string };
}
interface Domain { id: string; name: string; icon: string; color: string; roles: string; intro: string; sections: Section[]; }

const T = (b: boolean): Cell => ({ tgl: b });
const CRIT: Cell = { crit: true };

const DOMAINS: Domain[] = [
  { id: 'sys', name: 'Système', icon: 'ti-settings', color: '#4EA1FF', roles: 'A T',
    intro: "Identité, localisation et apparence de la plateforme. Ces réglages se propagent aux rapports, exports et à toute l'interface.",
    sections: [
      { id: 'general', icon: 'ti-settings', title: 'Général', desc: 'Identité institutionnelle : nom, entité, pays, fuseau, devise.', roles: 'A',
        usedIn: ['En-tête A4', 'Exports PDF', 'Pied de page', 'Notifications'], type: 'form', fields: [
          { l: 'Nom du système', v: 'GEstiDlo' }, { l: 'Sous-titre', v: 'Supervision AEP' },
          { l: 'Institution principale', sel: ['DINEPA', 'MTPTC', 'Ministère de la Santé'], v: 'DINEPA' },
          { l: 'Pays', sel: ['Haïti'], v: 'Haïti' },
          { l: 'Fuseau horaire', sel: ['America/Port-au-Prince', 'UTC'], v: 'America/Port-au-Prince' },
          { l: 'Devise', sel: ['HTG — Gourde', 'USD'], v: 'HTG — Gourde' },
          { l: 'Contact support', v: 'support@dinepa.gouv.ht', full: true },
          { l: 'Version système', v: 'v1.0.0', ro: true, hint: 'Lecture seule' },
        ] },
      { id: 'langues', icon: 'ti-language', title: 'Langues & formats', desc: 'Langue par défaut et formats de date, nombres et semaine.', roles: 'A T',
        usedIn: ['Interface', 'Rapports', 'Exports', 'Notifications'], type: 'form', fields: [
          { l: 'Langue principale', sel: ['Français', 'Créole haïtien', 'Anglais'], v: 'Français' },
          { l: 'Langues disponibles', v: 'Français · Créole · Anglais' },
          { l: 'Format de date', sel: ['JJ/MM/AAAA', 'AAAA-MM-JJ'], v: 'JJ/MM/AAAA' },
          { l: 'Séparateur décimal', sel: ['Virgule (,)', 'Point (.)'], v: 'Virgule (,)' },
          { l: 'Premier jour de la semaine', sel: ['Lundi', 'Dimanche'], v: 'Lundi' },
          { l: 'Unités système international', toggle: true, on: true, tdesc: 'bar, m³/h, NTU, mg/L' },
        ] },
      { id: 'apparence', icon: 'ti-palette', title: 'Apparence', desc: "Thème, couleur d'accent et logo. L'apparence globale est réservée à l'admin.", roles: 'A T',
        usedIn: ['Interface', 'En-tête A4', 'Écran de connexion'], type: 'form', fields: [
          { l: 'Thème', sel: ['Sombre institutionnel', 'Clair', 'Auto (système)'], v: 'Sombre institutionnel' },
          { l: 'Couleur principale', v: '#4EA1FF', swatch: true },
          { l: 'Densité des tableaux', sel: ['Confortable', 'Compacte'], v: 'Confortable' },
          { l: 'Logo institutionnel', v: 'dinepa-logo.svg', hint: 'SVG · 512×512', full: true },
        ] },
    ] },

  { id: 'org', name: 'Organisation', icon: 'ti-map-2', color: '#818CF8', roles: 'A U',
    intro: "Découpage territorial, URD, institutions et zones de desserte. Base de toutes les affectations.",
    sections: [
      { id: 'territoire', icon: 'ti-map-2', title: 'Départements & communes', desc: 'Les 10 départements et leurs communes.', roles: 'A',
        usedIn: ['Utilisateurs', 'Carte', 'Ressources', 'Rapports'], type: 'table', cols: ['Département', 'Chef-lieu', 'Communes', 'Statut'], rows: [
          ['<b>Ouest</b>', 'Port-au-Prince', '<span class="code">20</span>', '<span class="tag ok"><span class="td"></span>Actif</span>'],
          ['<b>Nord</b>', 'Cap-Haïtien', '<span class="code">19</span>', '<span class="tag ok"><span class="td"></span>Actif</span>'],
          ['<b>Artibonite</b>', 'Gonaïves', '<span class="code">15</span>', '<span class="tag ok"><span class="td"></span>Actif</span>'],
          ['<b>Sud</b>', 'Les Cayes', '<span class="code">18</span>', '<span class="tag ok"><span class="td"></span>Actif</span>'],
        ] },
      { id: 'urd', icon: 'ti-building', title: 'URD', desc: 'Une Unité Régionale de Desserte par département — pivot de la portée superviseur.', roles: 'A',
        usedIn: ['Superviseurs', 'Portée JWT', 'Rapports URD'], type: 'table', cols: ['URD', 'Département', 'Responsable', 'Statut'], rows: [
          ['<b>URD Ouest</b>', 'Ouest', 'Sandra Sewell', '<span class="tag ok"><span class="td"></span>Actif</span>'],
          ['<b>URD Nord</b>', 'Nord', 'Jean R. Pierre', '<span class="tag ok"><span class="td"></span>Actif</span>'],
          ['<b>URD Artibonite</b>', 'Artibonite', '—', '<span class="tag warn"><span class="td"></span>À configurer</span>'],
        ] },
      { id: 'zones', icon: 'ti-stack-2', title: 'Zones de desserte', desc: 'Pop. desservie = somme des populations cibles des zones actives.', roles: 'A U',
        usedIn: ['Ressources', 'Recensement', 'Couverture'], type: 'table', cols: ['Zone', 'Commune', 'Population cible', 'Statut'], rows: [
          ['<b>Carrefour-Centre</b>', 'Carrefour', '<span class="code">48 200</span>', '<span class="tag ok"><span class="td"></span>Active</span>'],
          ['<b>Léogâne-Nord</b>', 'Léogâne', '<span class="code">22 500</span>', '<span class="tag ok"><span class="td"></span>Active</span>'],
          ['<b>Delmas-33</b>', 'Delmas', '<span class="code">—</span>', '<span class="tag warn"><span class="td"></span>À recenser</span>'],
        ] },
    ] },

  { id: 'acc', name: 'Accès', icon: 'ti-users', color: '#A78BFA', roles: 'A U T',
    intro: "Comptes, rôles et permissions. La portée territoriale reste dérivée du JWT côté serveur.",
    sections: [
      { id: 'utilisateurs', icon: 'ti-users', title: 'Utilisateurs', desc: "Comptes et affectations. L'URD ne gère que son territoire.", roles: 'A U',
        usedIn: ['Authentification', 'Portée JWT', 'Notifications'], type: 'table', cols: ['Utilisateur', 'Rôle', 'Affectation', 'Statut'], rows: [
          ['<b>Sandra Sewell</b>', 'Superviseur URD', 'URD Ouest', '<span class="tag ok"><span class="td"></span>Actif</span>'],
          ['<b>Pierre Alexis</b>', 'Technicien', 'Carrefour', '<span class="tag ok"><span class="td"></span>Actif</span>'],
          ['<b>Admin DINEPA</b>', 'Admin national', 'National', '<span class="tag ok"><span class="td"></span>Actif</span>'],
        ] },
      { id: 'roles', icon: 'ti-shield-check', title: 'Rôles & permissions', desc: 'Matrice des actions autorisées par rôle.', roles: 'A',
        usedIn: ['Toutes les pages', "Boutons d'action", 'Garde API'], type: 'matrix' },
      { id: 'profils', icon: 'ti-user', title: 'Profils terrain', desc: 'Réglages personnels du technicien : profil, langue, notifications, mot de passe.', roles: 'A U T',
        usedIn: ['App mobile', 'Notifications', 'Session'], type: 'form', fields: [
          { l: 'Nom affiché', v: 'Pierre Alexis' },
          { l: 'Commune', v: 'Carrefour', ro: true, hint: "Défini par l'URD" },
          { l: 'Langue', sel: ['Français', 'Créole haïtien', 'Anglais'], v: 'Créole haïtien' },
          { l: 'Notifications push', toggle: true, on: true, tdesc: 'Alertes et interventions' },
          { l: 'Mot de passe', v: '••••••••', hint: 'Modifié il y a 12 j', full: true },
        ] },
    ] },

  { id: 'net', name: 'Réseau AEP', icon: 'ti-building-factory-2', color: '#38BDF8', roles: 'A',
    intro: "Ouvrages, états et points d'eau du réseau AEP.",
    sections: [
      { id: 'infra', icon: 'ti-building-factory-2', title: "Types d'infrastructures", desc: 'Catalogue des ouvrages gérés.', roles: 'A',
        usedIn: ['Infrastructures', 'Carte', 'Interventions'], type: 'table', cols: ['Ouvrage', 'Catégorie', 'Statut'], rows: [
          ['<b>Source de captage</b>', 'Production', '<span class="tag ok"><span class="td"></span>Actif</span>'],
          ['<b>Réservoir</b>', 'Stockage', '<span class="tag ok"><span class="td"></span>Actif</span>'],
          ['<b>Station de pompage</b>', 'Refoulement', '<span class="tag ok"><span class="td"></span>Actif</span>'],
          ['<b>Borne-fontaine</b>', 'Distribution', '<span class="tag ok"><span class="td"></span>Actif</span>'],
        ] },
      { id: 'etats', icon: 'ti-gauge', title: 'États des ouvrages', desc: 'Cycle de vie utilisé par les alertes automatiques.', roles: 'A',
        usedIn: ['Carte', 'Alertes auto', 'Dashboard'], type: 'pills',
        pills: [['Normal', 'ok'], ['Dégradé', 'warn'], ['Critique', 'crit'], ['Hors service', 'crit'], ['En maintenance', 'info'], ['À inspecter', 'mut']] },
      { id: 'points', icon: 'ti-droplet', title: "Points d'eau", desc: "Types recensés lors de l'enquête terrain.", roles: 'A',
        usedIn: ['Recensement', 'Ressources', 'Couverture'], type: 'pills', link: { label: 'Éditeur réel — types de points', path: '/admin/config/point-types' },
        pills: [['Borne-fontaine', 'info'], ['Branchement privé', 'info'], ['Kiosque', 'info'], ['Puits communautaire', 'mut'], ['Point naturel', 'mut']] },
    ] },

  { id: 'iot', name: 'IoT & mesures', icon: 'ti-cpu', color: '#2DD4BF', roles: 'A',
    intro: "Grandeurs mesurées, capteurs, passerelles et cadence de collecte.",
    sections: [
      { id: 'mesures', icon: 'ti-ruler-2', title: 'Types de mesures', desc: 'Grandeurs collectées : code, unité, domaine.', roles: 'A',
        usedIn: ['Capteurs', 'Alertes', 'Seuils', 'Rapports IoT'], type: 'table', cols: ['Code', 'Libellé', 'Unité', 'Usage'], link: { label: 'Éditeur réel — types de mesures', path: '/admin/config/measurement-types' }, rows: [
          ['<span class="code">PRESSION</span>', 'Pression', '<span class="unit">bar</span>', 'réseau'],
          ['<span class="code">DEBIT</span>', 'Débit', '<span class="unit">m³/h</span>', 'conduite'],
          ['<span class="code">NIVEAU</span>', 'Niveau', '<span class="unit">% · m</span>', 'réservoir'],
          ['<span class="code">CHLORE</span>', 'Chlore résiduel', '<span class="unit">mg/L</span>', 'qualité'],
          ['<span class="code">TURBIDITE</span>', 'Turbidité', '<span class="unit">NTU</span>', 'qualité'],
        ] },
      { id: 'capteurs', icon: 'ti-cpu-2', title: 'Types de capteurs', desc: 'Matériel déployé et grandeur mesurée.', roles: 'A',
        usedIn: ['Capteurs', 'Maintenance', 'Rapports IoT'], type: 'table', cols: ['Capteur', 'Mesure', 'Prototype', 'Statut'], rows: [
          ['<b>Capteur de pression</b>', 'PRESSION', 'ESP32 + ADS1115', '<span class="tag ok"><span class="td"></span>Actif</span>'],
          ['<b>Sonde de niveau</b>', 'NIVEAU', '—', '<span class="tag ok"><span class="td"></span>Actif</span>'],
          ['<b>Sonde pH / chlore</b>', 'CHLORE', '—', '<span class="tag ok"><span class="td"></span>Actif</span>'],
        ] },
      { id: 'collecte', icon: 'ti-clock', title: 'Fréquence de collecte', desc: 'Cadence télémétrie et fenêtre de polling.', roles: 'A',
        usedIn: ['Télémétrie', 'Polling 3–5 s', 'Qualité signal'], type: 'form', fields: [
          { l: 'Intervalle de mesure', sel: ['3 secondes', '5 secondes', '10 secondes', '30 secondes'], v: '5 secondes' },
          { l: 'Fenêtre polling backend', v: '3–5 s', ro: true },
          { l: 'Délai « hors ligne »', v: '2 minutes sans mesure' },
          { l: 'Transport temps réel', toggle: true, on: true, tdesc: 'SSE · rooms dinepa / urd / commune' },
        ] },
    ] },

  { id: 'alr', name: 'Alertes & seuils', icon: 'ti-bell', color: '#FBBF24', roles: 'A U',
    intro: "Règles qui déclenchent les alertes. Cœur de la sécurité du réseau — chaque seuil se propage à l'IoT, au dashboard et aux interventions.",
    sections: [
      { id: 'seuils', icon: 'ti-gauge', title: 'Seuils', desc: "Bornes normal / alerte / critique par grandeur. Ajuste le seuil critique de pression via l'aperçu à droite →", roles: 'A U',
        usedIn: ['Capteurs IoT', 'Alertes auto', 'Dashboard', 'Rapports', 'Interventions'], preview: 'gauge',
        type: 'table', cols: ['Mesure', 'Normal', 'Alerte', 'Critique', 'Actif'], link: { label: 'Éditeur réel — seuils', path: '/admin/config/thresholds' }, rows: [
          ['<b>Pression</b>', '1.5 — 5 bar', '&lt; 1.5 bar', CRIT, T(true)],
          ['<b>Niveau réservoir</b>', '&gt; 40 %', '20 — 40 %', '<span class="cr">&lt; 20 %</span>', T(true)],
          ['<b>Débit</b>', 'stable', 'variation forte', '<span class="cr">débit nul</span>', T(true)],
          ['<b>Chlore résiduel</b>', 'conforme', 'faible', '<span class="cr">absent</span>', T(true)],
          ['<b>Turbidité</b>', 'basse', 'élevée', '<span class="cr">très élevée</span>', T(false)],
        ] },
      { id: 'types-alr', icon: 'ti-bell', title: "Types d'alertes", desc: 'Catégories émises automatiquement sur transition ou dépassement.', roles: 'A U',
        usedIn: ['Alertes auto', 'Notifications', 'Interventions'], type: 'pills',
        pills: [['Pollution eau', 'crit'], ['Panne équipement', 'crit'], ['Pression anormale', 'warn'], ['Rupture service', 'crit'], ['Capteur hors ligne', 'mut'], ['Qualité dégradée', 'warn']] },
      { id: 'regles', icon: 'ti-arrows-split-2', title: 'Règles de notification', desc: 'Événement → gravité → destinataires.', roles: 'A U',
        usedIn: ['Notifications', 'SSE / Rooms', 'Interventions'], type: 'table', cols: ['Événement', 'Gravité', 'Destinataires', 'Actif'], rows: [
          ['Pression &lt; 1 bar · 10 min', '<span class="tag crit"><span class="td"></span>Critique</span>', 'Technicien + URD', T(true)],
          ['Eau polluée détectée', '<span class="tag crit"><span class="td"></span>Critique</span>', 'URD + DINEPA', T(true)],
          ['Capteur hors ligne', '<span class="tag mut"><span class="td"></span>Faible</span>', 'Admin DINEPA', T(true)],
        ] },
    ] },

  { id: 'itv', name: 'Interventions', icon: 'ti-tool', color: '#FB923C', roles: 'A U',
    intro: "Types, priorités, statuts et checklists des interventions terrain.",
    sections: [
      { id: 'types-itv', icon: 'ti-tool', title: "Types d'intervention", desc: 'Catalogue des travaux terrain.', roles: 'A U',
        usedIn: ['Création', 'Fiche technicien', 'Rapports'], type: 'pills',
        pills: [['Inspection', 'info'], ['Réparation', 'warn'], ['Maintenance préventive', 'ok'], ['Remplacement', 'warn'], ['Contrôle qualité', 'info'], ['Fuite', 'crit'], ['Pompe en panne', 'crit']] },
      { id: 'priorites', icon: 'ti-flag-2', title: 'Priorités & délais cibles', desc: 'Délais alimentant le calcul MTTR/SLA.', roles: 'A U',
        usedIn: ['Interventions', 'MTTR / SLA', 'Dashboard'], type: 'table', cols: ['Priorité', 'Délai cible', 'Actif'], rows: [
          ['<b>Critique</b>', '<span class="code">24 h</span>', T(true)],
          ['<b>Élevée</b>', '<span class="code">48 h</span>', T(true)],
          ['<b>Moyenne</b>', '<span class="code">72 h</span>', T(true)],
          ['<b>Faible</b>', '<span class="code">7 jours</span>', T(true)],
        ] },
      { id: 'statuts-itv', icon: 'ti-list-check', title: 'Statuts', desc: 'États de la création à la validation.', roles: 'A U',
        usedIn: ['Interventions', 'Dashboard', 'Traçabilité'], type: 'pills',
        pills: [['Créée', 'mut'], ['Assignée', 'info'], ['En cours', 'warn'], ['Terminée', 'ok'], ['Validée', 'ok'], ['Renvoyée', 'crit']] },
    ] },

  { id: 'rpt', name: 'Rapports & signatures', icon: 'ti-file-text', color: '#4EA1FF', roles: 'A U',
    intro: "Modèles A4, sections obligatoires, chaîne de validation et signatures.",
    sections: [
      { id: 'types-rpt', icon: 'ti-file-text', title: 'Types de rapports', desc: 'Catalogue et sections obligatoires.', roles: 'A U',
        usedIn: ['Aperçu A4', 'Exports', 'Numérotation'], type: 'table', cols: ['Rapport', 'Sections obligatoires', 'Statut'], rows: [
          ['<b>Intervention</b>', 'résumé · localisation · diagnostic · photos', '<span class="tag ok"><span class="td"></span>Actif</span>'],
          ['<b>IoT / capteurs</b>', 'mesures · anomalies · seuils', '<span class="tag ok"><span class="td"></span>Actif</span>'],
          ['<b>Mensuel URD</b>', 'zones · incidents · interventions', '<span class="tag ok"><span class="td"></span>Actif</span>'],
        ] },
      { id: 'validation', icon: 'ti-signature', title: 'Chaîne de validation', desc: 'valider() fige snapshot + hash, signer() le vérifie. SUPERSEDEE remplace toute suppression.', roles: 'A',
        usedIn: ['Signatures', 'Traçabilité', 'Audit'], type: 'workflow',
        steps: [['1', 'Technicien', 'Soumet le rapport'], ['2', 'Responsable URD', 'valider() → snapshot + hash'], ['3', 'DINEPA national', 'signer() → vérifie le hash'], ['4', 'Archivage', 'Verrouillé · SUPERSEDEE']] },
      { id: 'motifs', icon: 'ti-flag-2', title: 'Motifs de renvoi', desc: 'Retours standardisés proposés au technicien / URD.', roles: 'A U',
        usedIn: ['Renvoi rapport', 'Notifications'], type: 'pills',
        pills: [['Photos manquantes', 'warn'], ['Localisation incomplète', 'warn'], ['Diagnostic insuffisant', 'warn'], ['Données IoT incohérentes', 'crit'], ['Signature manquante', 'crit']] },
    ] },

  { id: 'aud', name: 'Sécurité & audit', icon: 'ti-shield-lock', color: '#94A3B8', roles: 'A',
    intro: "Sessions, mots de passe, journalisation et conservation des données.",
    sections: [
      { id: 'securite', icon: 'ti-lock', title: 'Sécurité & sessions', desc: 'Durée de session, mot de passe, verrouillage, 2FA.', roles: 'A',
        usedIn: ['Authentification', 'Session JWT', 'Comptes'], type: 'form', fields: [
          { l: 'Durée de session', sel: ['1 heure', '8 heures', '24 heures'], v: '8 heures' },
          { l: 'Longueur min. mot de passe', v: '10 caractères' },
          { l: 'Verrouillage après', v: '5 tentatives' },
          { l: 'Double validation (2FA)', sel: ['Désactivée', 'Optionnelle', 'Obligatoire (admin)'], v: 'Désactivée' },
        ] },
      { id: 'journal', icon: 'ti-history', title: 'Journalisation', desc: 'Actions sensibles tracées, horodatées et attribuées.', roles: 'A',
        usedIn: ["Journal d'audit", 'Exports', 'Conformité'], type: 'table', cols: ['Action tracée', 'Rôle', 'Tracée'], rows: [
          ['Suppression de ressource', 'Admin', T(true)],
          ['Modification de seuil', 'Admin · URD', T(true)],
          ['Signature de rapport', 'URD · DINEPA', T(true)],
          ['Export de données', 'Tous', T(true)],
        ] },
      { id: 'conservation', icon: 'ti-clock', title: 'Exports & conservation', desc: "Rétention des journaux et formats d'export.", roles: 'A',
        usedIn: ["Journal d'audit", 'Exports', 'Archivage'], type: 'form', fields: [
          { l: 'Conservation du journal', sel: ['12 mois', '24 mois', '60 mois'], v: '24 mois' },
          { l: "Format d'export", sel: ['CSV', 'PDF', 'CSV + PDF'], v: 'CSV + PDF' },
          { l: 'Export automatique mensuel', toggle: true, on: true, tdesc: '1er du mois · vers archivage' },
        ] },
    ] },
];

const MATRIX: [string, string, string, string][] = [
  ['Créer une ressource', 'ok', 'ok', 'no'], ['Créer une alerte', 'ok', 'ok', 'ok'], ['Soumettre un rapport', 'ok', 'ok', 'ok'],
  ['Signer rapport URD', 'no', 'ok', 'no'], ['Signer rapport DINEPA', 'ok', 'no', 'no'], ['Modifier un seuil', 'ok', 'loc', 'no'],
  ['Gérer les utilisateurs', 'ok', 'loc', 'no'], ['Archiver', 'ok', 'no', 'no'],
];

@Component({
  selector: 'app-parametres-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="p2" [class.p2--nav]="navOpen()" [class.p2--rail]="railOpen()">

  <!-- Topbar -->
  <div class="p2-top">
    <button class="p2-hbtn p2-only-mob" (click)="navOpen.set(!navOpen())"><i class="ti ti-menu-2"></i></button>
    <div class="p2-search"><i class="ti ti-search"></i><input [(ngModel)]="query" (ngModelChange)="onSearch()" placeholder="Rechercher un paramètre…"></div>
    <div class="p2-spacer"></div>
    <button class="p2-hbtn p2-only-tab" (click)="railOpen.set(!railOpen())"><i class="ti ti-layout-sidebar-right"></i> Impact</button>
    <div class="p2-scope">
      <span class="p2-scope__l">Portée</span>
      <div class="p2-seg">
        <button *ngFor="let r of ROLES" class="p2-seg__b" [class.on]="role()===r.id" [style.--c]="r.color" (click)="setRole(r.id)">
          <span class="p2-seg__d"></span>{{ r.short }}
        </button>
      </div>
    </div>
  </div>

  <div class="p2-body">

    <!-- NAV domaines -->
    <nav class="p2-nav">
      <div class="p2-nav__t">Domaines de configuration</div>
      <button *ngFor="let d of visibleDomains()" class="p2-nitem" [class.on]="d.id===activeDomain()" [style.--dc]="d.color" (click)="selectDomain(d.id)">
        <i class="ti {{ d.icon }} p2-nic"></i>{{ d.name }}<span class="p2-ncount">{{ sectionsOf(d).length }}</span>
      </button>
      <div class="p2-nav__e" *ngIf="visibleDomains().length===0">Aucun domaine ne correspond pour ce rôle.</div>
    </nav>

    <!-- MAIN -->
    <main class="p2-main" *ngIf="domain() as d" [style.--dc]="d.color">
      <div class="p2-head">
        <div class="p2-crumb"><span>Paramètres</span><i class="ti ti-chevron-right"></i><b [style.color]="d.color">{{ d.name }}</b></div>
        <h2 class="p2-h2"><span class="p2-hic"><i class="ti {{ d.icon }}"></i></span>{{ d.name }}</h2>
        <p class="p2-intro">{{ d.intro }}</p>
      </div>

      <div class="p2-sec" *ngFor="let s of visibleSections()" [id]="'sec-' + s.id" [class.active]="s.id===activeSection()"
           [style.--dc]="d.color" (mouseenter)="activeSection.set(s.id)">
        <div class="p2-sec__h" (click)="focusSection(s.id)">
          <div class="p2-sec__ic"><i class="ti {{ s.icon }}"></i></div>
          <div><h3>{{ s.title }}</h3><p>{{ s.desc }}</p></div>
          <div class="p2-sec__meta"><span class="p2-propchip"><i class="ti ti-link"></i> {{ s.usedIn.length }} modules</span></div>
        </div>

        <!-- FORM -->
        <div class="p2-fgrid" *ngIf="s.type==='form'">
          <ng-container *ngFor="let f of s.fields">
            <div class="p2-frow p2-frow--tgl full" *ngIf="f.toggle">
              <div class="p2-tl"><label>{{ f.l }}</label><span class="p2-hint" *ngIf="f.tdesc">{{ f.tdesc }}</span></div>
              <span class="tgl" [class.on]="f.on" (click)="toggleField(f)"></span>
            </div>
            <div class="p2-frow" [class.full]="f.full" *ngIf="!f.toggle">
              <label>{{ f.l }}</label>
              <div class="p2-swatch" *ngIf="f.swatch"><span class="p2-sw" [style.background]="f.v"></span><input [(ngModel)]="f.v" (ngModelChange)="dirty(f.l)"></div>
              <select *ngIf="f.sel && !f.swatch" [disabled]="!!f.ro" [(ngModel)]="f.v" (ngModelChange)="dirty(f.l)"><option *ngFor="let o of f.sel">{{ o }}</option></select>
              <input *ngIf="!f.sel && !f.swatch" [value]="f.v || ''" [disabled]="!!f.ro" (input)="dirty(f.l)">
              <span class="p2-hint" *ngIf="f.hint">{{ f.hint }}</span>
            </div>
          </ng-container>
        </div>

        <!-- TABLE -->
        <ng-container *ngIf="s.type==='table'">
          <div class="p2-tbl-wrap">
            <table class="p2-tbl">
              <thead><tr><th *ngFor="let c of s.cols">{{ c }}</th><th class="p2-r">Actions</th></tr></thead>
              <tbody>
                <tr *ngFor="let row of s.rows">
                  <td *ngFor="let c of row">
                    <span *ngIf="isStr(c)" [innerHTML]="c"></span>
                    <span *ngIf="isCrit(c)" class="cr">&lt; {{ critBar().toFixed(1) }} bar</span>
                    <span *ngIf="isTgl(c)" class="tgl" [class.on]="asTgl(c).tgl" (click)="toggleCell(asTgl(c))"></span>
                  </td>
                  <td class="p2-r"><div class="p2-rowact">
                    <button class="p2-ico"><i class="ti ti-edit"></i></button>
                    <button class="p2-ico p2-ico--d"><i class="ti ti-trash"></i></button>
                  </div></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="p2-sec__foot">
            <button class="p2-addbtn"><i class="ti ti-plus"></i> Ajouter une entrée</button>
            <a class="p2-reallink" *ngIf="s.link" [routerLink]="s.link.path"><i class="ti ti-external-link"></i> {{ s.link.label }}</a>
          </div>
        </ng-container>

        <!-- PILLS -->
        <ng-container *ngIf="s.type==='pills'">
          <div class="p2-pills">
            <span class="p2-pill" *ngFor="let p of s.pills"><span class="tag {{ p[1] }} p2-dot"><span class="td"></span></span>{{ p[0] }}<i class="ti ti-x p2-x"></i></span>
            <button class="p2-addbtn"><i class="ti ti-plus"></i> Ajouter</button>
          </div>
          <div class="p2-sec__foot" *ngIf="s.link"><a class="p2-reallink" [routerLink]="s.link.path"><i class="ti ti-external-link"></i> {{ s.link.label }}</a></div>
        </ng-container>

        <!-- MATRIX -->
        <div class="p2-tbl-wrap" *ngIf="s.type==='matrix'">
          <table class="p2-tbl">
            <thead><tr><th>Action</th><th class="p2-c" style="color:#4EA1FF">Admin</th><th class="p2-c" style="color:#2DD4BF">URD</th><th class="p2-c" style="color:#FBBF24">Technicien</th></tr></thead>
            <tbody>
              <tr *ngFor="let m of MATRIX">
                <td><b>{{ m[0] }}</b></td>
                <td class="p2-c"><span class="p2-cell p2-cell--{{ m[1] }}">{{ cellLabel(m[1]) }}</span></td>
                <td class="p2-c"><span class="p2-cell p2-cell--{{ m[2] }}">{{ cellLabel(m[2]) }}</span></td>
                <td class="p2-c"><span class="p2-cell p2-cell--{{ m[3] }}">{{ cellLabel(m[3]) }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- WORKFLOW -->
        <div class="p2-flow" *ngIf="s.type==='workflow'">
          <ng-container *ngFor="let st of s.steps; let last = last">
            <div class="p2-fstep"><div class="p2-fn">{{ st[0] }}</div><h5>{{ st[1] }}</h5><p>{{ st[2] }}</p></div>
            <div class="p2-farrow" *ngIf="!last"><i class="ti ti-arrow-right"></i></div>
          </ng-container>
        </div>
      </div>
    </main>

    <!-- RAIL Impact -->
    <aside class="p2-rail" *ngIf="section() as cur" [style.--dc]="domain()!.color">
      <div class="p2-rblock">
        <div class="p2-rlbl"><i class="ti ti-pin"></i> Sur cette page</div>
        <div class="p2-onpage">
          <a *ngFor="let s of visibleSections()" [class.on]="s.id===activeSection()" (click)="focusSection(s.id)"><span class="p2-pd"></span>{{ s.title }}</a>
        </div>
      </div>

      <div class="p2-rblock">
        <div class="p2-rlbl"><i class="ti ti-link"></i> Impact — {{ cur.title }}</div>
        <div class="p2-impact">
          <h4><i class="ti ti-info-circle"></i> Propagation</h4>
          <div class="p2-isub">Un changement ici se répercute automatiquement dans :</div>
          <div class="p2-ichips"><span class="p2-ichip" *ngFor="let u of cur.usedIn"><span class="p2-cd"></span>{{ u }}</span></div>
        </div>

        <!-- Gauge -->
        <div class="p2-impact" *ngIf="cur.preview==='gauge'">
          <h4><i class="ti ti-gauge"></i> Aperçu — seuil critique pression</h4>
          <div class="p2-isub">Position du seuil dans la plage 0–5 bar</div>
          <div class="p2-gauge">
            <div class="p2-gval">{{ critBar().toFixed(1) }}<small>bar</small></div>
            <svg viewBox="0 0 220 120" width="200" height="110">
              <path [attr.d]="arcD(0, critBar())" stroke="#F87171" stroke-width="13" fill="none" stroke-linecap="round"/>
              <path [attr.d]="arcD(critBar(), 1.5)" stroke="#FBBF24" stroke-width="13" fill="none" stroke-linecap="round"/>
              <path [attr.d]="arcD(1.5, 5)" stroke="#34D399" stroke-width="13" fill="none" stroke-linecap="round"/>
              <line x1="110" y1="104" [attr.x2]="needle().x" [attr.y2]="needle().y" stroke="#EAF0FB" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="110" cy="104" r="5" fill="#EAF0FB"/>
              <text x="14" y="118" fill="#61708E" font-size="9">0</text><text x="196" y="118" fill="#61708E" font-size="9">5 bar</text>
            </svg>
            <input type="range" class="p2-rng" min="0.4" max="2.5" step="0.1" [ngModel]="critBar()" (ngModelChange)="setCrit($event)">
            <div class="p2-glegend"><span><i style="background:#F87171"></i>Critique</span><span><i style="background:#FBBF24"></i>Alerte</span><span><i style="background:#34D399"></i>Normal</span></div>
          </div>
        </div>
      </div>

      <div class="p2-tip"><i class="ti ti-info-circle"></i><div><b>Source unique de vérité.</b> La portée territoriale (commune · département · national) est dérivée du JWT côté serveur — jamais réglée sur cette page.</div></div>
    </aside>
  </div>

  <!-- SAVE BAR -->
  <div class="p2-save" [class.show]="dirtyCount()>0">
    <span class="p2-sdot"></span>
    <div><div class="p2-stxt"><b>{{ dirtyCount() }} modification{{ dirtyCount()>1 ? 's' : '' }}</b> non enregistrée{{ dirtyCount()>1 ? 's' : '' }}</div>
      <div class="p2-ssub">Les changements seront propagés à l'ensemble des modules concernés.</div></div>
    <div class="p2-sact">
      <button class="p2-btn" (click)="cancel()"><i class="ti ti-x"></i> Annuler</button>
      <button class="p2-btn p2-btn--primary" (click)="save()"><i class="ti ti-check"></i> Enregistrer</button>
    </div>
  </div>

  <div class="p2-scrim" *ngIf="navOpen() || railOpen()" (click)="navOpen.set(false); railOpen.set(false)"></div>
</div>
  `,
  styles: [`
:host {
  --bg:#070A12; --panel:#0D1422; --panel2:#0B111E; --panelhi:#13203A;
  --bd:rgba(148,163,184,.09); --bd2:rgba(148,163,184,.15); --bd3:rgba(148,163,184,.22);
  --tx:#EAF0FB; --tx2:#AAB7D1; --tx3:#8593AE; --mut:#61708E;
  --acc:#4EA1FF; --accsoft:rgba(78,161,255,.11); --accbrd:rgba(78,161,255,.32);
  --green:#34D399; --amber:#FBBF24; --red:#F87171;
  display:block; height:100%;
  background:radial-gradient(1100px 560px at 88% -8%,rgba(78,161,255,.06),transparent 60%),radial-gradient(760px 440px at -8% 108%,rgba(45,212,191,.045),transparent 55%),var(--bg);
  color:var(--tx); font-size:14px;
}
.p2 { display:flex; flex-direction:column; height:100%; overflow:hidden; }

/* Topbar */
.p2-top { display:flex; align-items:center; gap:14px; padding:0 18px; height:56px; border-bottom:1px solid var(--bd); flex-shrink:0; }
.p2-search { flex:1; max-width:420px; display:flex; align-items:center; gap:.5rem; background:var(--panel2); border:1px solid var(--bd); border-radius:10px; padding:0 12px; height:37px; }
.p2-search i { color:var(--mut); font-size:16px; }
.p2-search input { flex:1; border:0; background:none; color:var(--tx); font-size:13px; outline:none; font-family:inherit; }
.p2-search input::placeholder { color:var(--mut); }
.p2-spacer { flex:1; }
.p2-scope { display:flex; align-items:center; gap:9px; }
.p2-scope__l { font-size:10px; color:var(--mut); letter-spacing:.5px; text-transform:uppercase; font-weight:700; }
.p2-seg { display:flex; background:var(--panel2); border:1px solid var(--bd); border-radius:10px; padding:3px; gap:2px; }
.p2-seg__b { display:flex; align-items:center; gap:7px; padding:6px 11px; border-radius:7px; font-size:12px; font-weight:650; color:var(--tx3); background:none; border:0; cursor:pointer; white-space:nowrap; font-family:inherit; }
.p2-seg__d { width:6px; height:6px; border-radius:50%; background:currentColor; opacity:.7; }
.p2-seg__b.on { background:var(--panelhi); color:var(--tx); }
.p2-seg__b.on .p2-seg__d { background:var(--c); opacity:1; box-shadow:0 0 9px var(--c); }
.p2-hbtn { display:inline-flex; align-items:center; gap:6px; padding:8px 11px; border-radius:9px; border:1px solid var(--bd); background:var(--panel2); color:var(--tx2); font-size:12px; font-family:inherit; cursor:pointer; }
.p2-only-mob { display:none; } .p2-only-tab { display:none; }

/* Body grid */
.p2-body { flex:1; display:grid; grid-template-columns:248px 1fr 328px; min-height:0; }

/* Nav */
.p2-nav { border-right:1px solid var(--bd); overflow-y:auto; padding:14px 12px 30px; background:var(--panel2); }
.p2-nav__t { font-size:10px; font-weight:750; letter-spacing:.9px; text-transform:uppercase; color:var(--mut); padding:2px 12px 10px; }
.p2-nitem { display:flex; align-items:center; gap:11px; width:100%; padding:9px 12px; border-radius:9px; font-size:13px; color:var(--tx2); text-align:left; background:none; border:0; cursor:pointer; position:relative; margin-bottom:2px; font-family:inherit; }
.p2-nic { font-size:18px; color:var(--slate,#94A3B8); opacity:.9; }
.p2-ncount { margin-left:auto; font-family:ui-monospace,monospace; font-size:10px; color:var(--mut); opacity:.8; }
.p2-nitem:hover { background:var(--panel); color:var(--tx); }
.p2-nitem.on { background:var(--panelhi); color:var(--tx); font-weight:650; }
.p2-nitem.on::before { content:''; position:absolute; left:-12px; top:8px; bottom:8px; width:3px; border-radius:0 3px 3px 0; background:var(--dc); box-shadow:0 0 12px var(--dc); }
.p2-nitem.on .p2-nic { color:var(--dc); opacity:1; }
.p2-nav__e { padding:20px 14px; font-size:12.5px; color:var(--mut); }

/* Main */
.p2-main { overflow-y:auto; padding:22px 26px 40px; }
.p2-head { margin-bottom:18px; }
.p2-crumb { display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--mut); margin-bottom:11px; }
.p2-crumb i { font-size:13px; } .p2-crumb b { font-weight:600; }
.p2-h2 { font-size:21px; font-weight:750; letter-spacing:-.3px; display:flex; align-items:center; gap:11px; margin:0; }
.p2-hic { width:32px; height:32px; border-radius:9px; display:grid; place-items:center; background:color-mix(in srgb,var(--dc) 12%,transparent); color:var(--dc); border:1px solid color-mix(in srgb,var(--dc) 32%,transparent); }
.p2-intro { color:var(--tx2); font-size:13px; margin:8px 0 0; max-width:640px; }

.p2-sec { background:linear-gradient(180deg,var(--panel),var(--panel2)); border:1px solid var(--bd); border-radius:14px; margin-bottom:15px; overflow:hidden; scroll-margin-top:16px; transition:border-color .16s, box-shadow .16s; }
.p2-sec.active { border-color:color-mix(in srgb,var(--dc) 30%,transparent); box-shadow:0 0 0 1px color-mix(in srgb,var(--dc) 14%,transparent),0 20px 44px -26px rgba(0,0,0,.85); }
.p2-sec__h { display:flex; align-items:flex-start; gap:12px; padding:15px 18px; cursor:pointer; }
.p2-sec__ic { width:34px; height:34px; border-radius:9px; display:grid; place-items:center; flex-shrink:0; background:color-mix(in srgb,var(--dc) 11%,transparent); color:var(--dc); border:1px solid color-mix(in srgb,var(--dc) 26%,transparent); font-size:18px; }
.p2-sec__h h3 { font-size:14.5px; font-weight:700; margin:0; } .p2-sec__h p { font-size:12px; color:var(--mut); margin:3px 0 0; max-width:560px; }
.p2-sec__meta { margin-left:auto; flex-shrink:0; }
.p2-propchip { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:650; color:var(--tx3); padding:4px 10px; border-radius:20px; border:1px solid var(--bd2); background:var(--panel2); }
.p2-propchip i { color:var(--dc); font-size:13px; }

/* Form */
.p2-fgrid { display:grid; grid-template-columns:1fr 1fr; }
.p2-frow { display:flex; flex-direction:column; gap:6px; padding:13px 18px; border-top:1px solid rgba(148,163,184,.06); }
.p2-frow.full { grid-column:1/-1; }
.p2-frow--tgl { flex-direction:row; align-items:center; justify-content:space-between; }
.p2-tl { display:flex; flex-direction:column; gap:3px; }
.p2-frow label { font-size:12px; font-weight:600; color:var(--tx2); }
.p2-hint { font-size:11px; color:var(--mut); }
.p2-frow input, .p2-frow select { height:37px; border-radius:9px; background:var(--panel2); border:1px solid var(--bd); color:var(--tx); padding:0 12px; font-size:13px; outline:none; font-family:inherit; }
.p2-frow input:focus, .p2-frow select:focus { border-color:var(--accbrd); box-shadow:0 0 0 3px var(--accsoft); }
.p2-frow input:disabled, .p2-frow select:disabled { opacity:.6; cursor:not-allowed; }
.p2-swatch { display:flex; align-items:center; gap:10px; }
.p2-sw { width:34px; height:34px; border-radius:9px; border:1px solid var(--bd2); flex-shrink:0; }
.p2-swatch input { flex:1; }

/* Toggle */
.tgl { position:relative; display:inline-block; width:40px; height:22px; border-radius:20px; background:var(--panelhi); border:1px solid var(--bd2); cursor:pointer; flex-shrink:0; vertical-align:middle; }
.tgl::after { content:''; position:absolute; left:2px; top:1.5px; width:17px; height:17px; border-radius:50%; background:var(--mut); transition:.16s; }
.tgl.on { background:var(--accsoft); border-color:var(--accbrd); }
.tgl.on::after { left:20px; background:var(--acc); }

/* Table */
.p2-tbl-wrap { overflow-x:auto; border-top:1px solid rgba(148,163,184,.06); }
.p2-tbl { width:100%; border-collapse:collapse; font-size:13px; }
.p2-tbl th { text-align:left; font-size:10.5px; font-weight:700; letter-spacing:.5px; text-transform:uppercase; color:var(--mut); padding:10px 18px; border-bottom:1px solid var(--bd); background:rgba(255,255,255,.012); white-space:nowrap; }
.p2-tbl td { padding:11px 18px; border-bottom:1px solid rgba(148,163,184,.055); color:var(--tx2); vertical-align:middle; }
.p2-tbl tbody tr:last-child td { border-bottom:none; }
.p2-tbl tbody tr:hover { background:rgba(255,255,255,.016); }
.p2-r { text-align:right; } .p2-c { text-align:center; }
.p2-tbl ::ng-deep b { color:var(--tx); }
.p2-tbl ::ng-deep .code { font-family:ui-monospace,monospace; font-size:12px; color:#38BDF8; background:rgba(56,189,248,.08); border:1px solid rgba(56,189,248,.16); padding:2px 8px; border-radius:6px; }
.p2-tbl ::ng-deep .unit { font-family:ui-monospace,monospace; font-size:12px; color:var(--tx2); }
.p2-tbl ::ng-deep .cr { color:var(--red); }
.p2-tbl ::ng-deep .tag { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:650; padding:3px 9px; border-radius:20px; border:1px solid; }
.p2-tbl ::ng-deep .tag .td { width:6px; height:6px; border-radius:50%; background:currentColor; }
::ng-deep .tag.ok { color:#34D399; border-color:rgba(52,211,153,.28); background:rgba(52,211,153,.08); }
::ng-deep .tag.warn { color:#FBBF24; border-color:rgba(251,191,36,.28); background:rgba(251,191,36,.08); }
::ng-deep .tag.crit { color:#F87171; border-color:rgba(248,113,113,.28); background:rgba(248,113,113,.08); }
::ng-deep .tag.info { color:#4EA1FF; border-color:rgba(78,161,255,.32); background:rgba(78,161,255,.11); }
::ng-deep .tag.mut { color:#61708E; border-color:rgba(148,163,184,.15); background:var(--panel2); }
.cr { color:var(--red); }
.p2-rowact { display:flex; gap:4px; justify-content:flex-end; }
.p2-ico { width:27px; height:27px; border-radius:7px; display:grid; place-items:center; color:var(--mut); border:1px solid transparent; background:none; cursor:pointer; }
.p2-ico i { font-size:15px; } .p2-ico:hover { background:var(--panelhi); color:var(--tx); border-color:var(--bd); }
.p2-ico--d:hover { color:var(--red); border-color:rgba(248,113,113,.3); }
.p2-sec__foot { display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:12px 18px; border-top:1px solid rgba(148,163,184,.06); }
.p2-addbtn { display:inline-flex; align-items:center; gap:7px; padding:8px 13px; border-radius:9px; font-size:12.5px; font-weight:650; color:var(--dc); border:1px dashed color-mix(in srgb,var(--dc) 40%,var(--bd2)); background:transparent; cursor:pointer; font-family:inherit; }
.p2-addbtn:hover { background:color-mix(in srgb,var(--dc) 8%,transparent); }
.p2-reallink { margin-left:auto; display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--acc); text-decoration:none; }
.p2-reallink:hover { text-decoration:underline; }

/* Pills */
.p2-pills { display:flex; flex-wrap:wrap; gap:9px; padding:15px 18px; border-top:1px solid rgba(148,163,184,.06); }
.p2-pill { display:inline-flex; align-items:center; gap:8px; padding:7px 12px; border-radius:9px; background:var(--panel2); border:1px solid var(--bd2); font-size:12.5px; color:var(--tx2); font-weight:550; }
.p2-dot { padding:2px 7px !important; }
.p2-x { color:var(--mut); opacity:.55; cursor:pointer; font-size:14px; } .p2-x:hover { opacity:1; color:var(--red); }

/* Matrix cells */
.p2-cell { display:inline-flex; justify-content:center; align-items:center; gap:5px; min-width:50px; font-size:11px; font-weight:650; padding:3px 9px; border-radius:20px; border:1px solid; }
.p2-cell--ok { color:#34D399; border-color:rgba(52,211,153,.28); background:rgba(52,211,153,.08); }
.p2-cell--no { color:#61708E; border-color:var(--bd2); background:var(--panel2); }
.p2-cell--loc { color:#4EA1FF; border-color:var(--accbrd); background:var(--accsoft); }

/* Workflow */
.p2-flow { display:flex; align-items:stretch; padding:18px; flex-wrap:wrap; gap:0; border-top:1px solid rgba(148,163,184,.06); }
.p2-fstep { flex:1; min-width:140px; background:var(--panel2); border:1px solid var(--bd2); border-radius:11px; padding:13px; }
.p2-fn { width:23px; height:23px; border-radius:7px; display:grid; place-items:center; font-family:ui-monospace,monospace; font-size:11px; font-weight:700; background:var(--accsoft); color:var(--acc); border:1px solid var(--accbrd); margin-bottom:8px; }
.p2-fstep h5 { font-size:12.5px; font-weight:700; margin:0; } .p2-fstep p { font-size:11px; color:var(--mut); margin:3px 0 0; }
.p2-farrow { display:grid; place-items:center; width:30px; color:var(--mut); }

/* Rail */
.p2-rail { border-left:1px solid var(--bd); overflow-y:auto; padding:20px 18px 40px; background:var(--panel2); }
.p2-rblock { margin-bottom:22px; }
.p2-rlbl { display:flex; align-items:center; gap:7px; font-size:10.5px; font-weight:750; letter-spacing:.6px; text-transform:uppercase; color:var(--mut); margin-bottom:12px; }
.p2-rlbl i { color:var(--dc); font-size:13px; }
.p2-onpage a { display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:8px; font-size:12.5px; color:var(--tx3); cursor:pointer; }
.p2-pd { width:6px; height:6px; border-radius:50%; background:var(--bd3); }
.p2-onpage a:hover { background:var(--panel); color:var(--tx); }
.p2-onpage a.on { color:var(--tx); font-weight:600; } .p2-onpage a.on .p2-pd { background:var(--dc); box-shadow:0 0 8px var(--dc); }
.p2-impact { background:var(--panel); border:1px solid var(--bd); border-radius:12px; padding:14px; margin-bottom:12px; }
.p2-impact h4 { font-size:13px; font-weight:700; margin:0 0 4px; display:flex; align-items:center; gap:6px; }
.p2-impact h4 i { color:var(--dc); }
.p2-isub { font-size:11.5px; color:var(--mut); margin-bottom:12px; }
.p2-ichips { display:flex; flex-wrap:wrap; gap:7px; }
.p2-ichip { display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; color:var(--tx2); padding:4px 9px; border-radius:20px; border:1px solid var(--bd2); background:var(--panel2); }
.p2-cd { width:5px; height:5px; border-radius:50%; background:var(--dc); }
.p2-gauge { display:flex; flex-direction:column; align-items:center; gap:10px; padding-top:4px; }
.p2-gval { font-family:ui-monospace,monospace; font-size:24px; font-weight:700; color:var(--red); }
.p2-gval small { font-size:12px; color:var(--mut); font-weight:500; margin-left:3px; }
.p2-glegend { display:flex; gap:12px; font-size:10.5px; color:var(--mut); }
.p2-glegend span { display:inline-flex; align-items:center; gap:5px; } .p2-glegend i { width:8px; height:8px; border-radius:2px; }
.p2-rng { width:100%; -webkit-appearance:none; appearance:none; height:5px; border-radius:20px; background:var(--panelhi); outline:none; cursor:pointer; }
.p2-rng::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; border-radius:50%; background:var(--acc); border:2px solid var(--bg); box-shadow:0 0 0 3px var(--accsoft); }
.p2-rng::-moz-range-thumb { width:16px; height:16px; border-radius:50%; background:var(--acc); border:2px solid var(--bg); }
.p2-tip { display:flex; gap:9px; font-size:11.5px; color:var(--tx3); background:var(--accsoft); border:1px solid var(--accbrd); border-radius:11px; padding:11px 13px; line-height:1.55; }
.p2-tip i { color:var(--acc); flex-shrink:0; margin-top:1px; } .p2-tip b { color:var(--tx2); }

/* Save bar */
.p2-save { display:flex; align-items:center; gap:14px; padding:0 24px; height:0; overflow:hidden; background:linear-gradient(180deg,rgba(19,32,58,.96),rgba(13,20,34,.96)); border-top:1px solid transparent; transition:height .2s, border-color .2s; flex-shrink:0; }
.p2-save.show { height:60px; border-top-color:var(--accbrd); }
.p2-sdot { width:9px; height:9px; border-radius:50%; background:var(--amber); box-shadow:0 0 12px var(--amber); }
.p2-stxt { font-size:13px; font-weight:600; } .p2-stxt b { color:var(--amber); }
.p2-ssub { font-size:11.5px; color:var(--mut); }
.p2-sact { margin-left:auto; display:flex; gap:9px; }
.p2-btn { display:inline-flex; align-items:center; gap:7px; padding:9px 16px; border-radius:9px; font-size:12.5px; font-weight:650; border:1px solid var(--bd2); background:var(--panelhi); color:var(--tx2); cursor:pointer; font-family:inherit; }
.p2-btn:hover { color:var(--tx); } .p2-btn i { font-size:15px; }
.p2-btn--primary { background:linear-gradient(180deg,#4EA1FF,#2f7fdb); color:#04121f; border-color:transparent; }

.p2-scrim { display:none; }

@media (max-width:1240px) {
  .p2-body { grid-template-columns:230px 1fr; }
  .p2-rail { position:fixed; right:0; top:56px; bottom:0; width:328px; z-index:45; transform:translateX(102%); transition:transform .22s; box-shadow:-20px 0 50px -20px rgba(0,0,0,.8); }
  .p2--rail .p2-rail { transform:none; }
  .p2-only-tab { display:inline-flex; }
}
@media (max-width:960px) {
  .p2-body { grid-template-columns:1fr; }
  .p2-nav { position:fixed; left:0; top:56px; bottom:0; width:264px; z-index:46; transform:translateX(-104%); transition:transform .22s; }
  .p2--nav .p2-nav { transform:none; }
  .p2-only-mob { display:inline-flex; }
  .p2-scope { display:none; }
  .p2-fgrid { grid-template-columns:1fr; }
  .p2-scrim { display:block; position:fixed; inset:56px 0 0 0; background:rgba(4,6,12,.6); z-index:44; }
}
  `],
})
export class ParametresPageComponent {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly ROLES = [
    { id: 'A' as Role, short: 'Admin', color: '#4EA1FF' },
    { id: 'U' as Role, short: 'URD', color: '#2DD4BF' },
    { id: 'T' as Role, short: 'Technicien', color: '#FBBF24' },
  ];
  readonly MATRIX = MATRIX;

  readonly role = signal<Role>('A');
  readonly activeDomain = signal<string>('sys');
  readonly activeSection = signal<string | null>(null);
  readonly critBar = signal(1.0);
  readonly dirtyCount = signal(0);
  private readonly dirtyKeys = new Set<string>();
  query = '';
  private readonly _q = signal('');
  readonly navOpen = signal(false);
  readonly railOpen = signal(false);

  constructor() {
    const roles = this.auth.userSnapshot()?.roles ?? [];
    if (roles.some(r => r.includes('TEPAC') || r.includes('TECH'))) this.role.set('T');
    else if (roles.some(r => r.includes('SUPERVISEUR') || r.includes('URD'))) this.role.set('U');
    this.ensureDomain();
  }

  private flag(): string { return this.role(); }
  sectionsOf(d: Domain): Section[] { return d.sections.filter(s => s.roles.includes(this.flag())); }

  readonly visibleDomains = computed<Domain[]>(() => {
    const f = this.role(); const q = this._q();
    return DOMAINS.filter(d => d.roles.includes(f) && d.sections.some(s => s.roles.includes(f)) && this.matchDomain(d, q));
  });
  private matchDomain(d: Domain, q: string): boolean {
    if (!q) return true;
    const hay = (d.name + ' ' + d.intro + ' ' + d.sections.map(s => s.title + ' ' + s.desc + ' ' + s.usedIn.join(' ')).join(' ')).toLowerCase();
    return hay.includes(q);
  }

  readonly domain = computed<Domain | null>(() => this.visibleDomains().find(d => d.id === this.activeDomain()) ?? this.visibleDomains()[0] ?? null);
  readonly visibleSections = computed<Section[]>(() => { const d = this.domain(); return d ? this.sectionsOf(d) : []; });
  readonly section = computed<Section | null>(() => {
    const secs = this.visibleSections();
    return secs.find(s => s.id === this.activeSection()) ?? secs[0] ?? null;
  });

  private ensureDomain(): void {
    const vds = this.visibleDomains();
    if (!vds.some(d => d.id === this.activeDomain())) this.activeDomain.set(vds[0]?.id ?? 'sys');
    this.activeSection.set(this.visibleSections()[0]?.id ?? null);
  }

  selectDomain(id: string): void { this.activeDomain.set(id); this.activeSection.set(this.visibleSections()[0]?.id ?? null); this.navOpen.set(false); const m = this.host.nativeElement.querySelector('.p2-main'); if (m) m.scrollTop = 0; }
  focusSection(id: string): void { this.activeSection.set(id); const el = this.host.nativeElement.querySelector('#sec-' + id) as HTMLElement | null; el?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  setRole(r: Role): void { this.role.set(r); this.dirtyKeys.clear(); this.dirtyCount.set(0); this.ensureDomain(); }
  onSearch(): void { this._q.set(this.query.trim().toLowerCase()); const vds = this.visibleDomains(); if (vds.length && !vds.some(d => d.id === this.activeDomain())) this.selectDomain(vds[0].id); }

  // Cells
  isStr(c: Cell): c is string { return typeof c === 'string'; }
  isTgl(c: Cell): boolean { return typeof c === 'object' && 'tgl' in c; }
  isCrit(c: Cell): boolean { return typeof c === 'object' && 'crit' in c; }
  asTgl(c: Cell): { tgl: boolean } { return c as { tgl: boolean }; }
  toggleCell(c: { tgl: boolean }): void { c.tgl = !c.tgl; this.dirty('cell'); }
  toggleField(f: Field): void { f.on = !f.on; this.dirty('field-' + f.l); }

  // Gauge
  private ang(v: number): number { return Math.PI - (Math.min(v, 5) / 5) * Math.PI; }
  private pt(v: number, rr: number): [number, number] { return [110 + rr * Math.cos(this.ang(v)), 104 - rr * Math.sin(this.ang(v))]; }
  arcD(a: number, b: number): string { const [ax, ay] = this.pt(a, 82); const [bx, by] = this.pt(b, 82); const large = (b - a) / 5 > 0.5 ? 1 : 0; return `M${ax.toFixed(2)} ${ay.toFixed(2)} A82 82 0 ${large} 1 ${bx.toFixed(2)} ${by.toFixed(2)}`; }
  needle(): { x: number; y: number } { const [x, y] = this.pt(this.critBar(), 60); return { x, y }; }
  setCrit(v: number): void { this.critBar.set(+v); this.dirty('seuil-pression-critique'); }

  // Dirty / save
  dirty(key: string): void { const k = key + Math.random().toString(36).slice(2, 5); this.dirtyKeys.add(k); this.dirtyCount.set(this.dirtyKeys.size); }
  save(): void { const n = this.dirtyKeys.size; this.dirtyKeys.clear(); this.dirtyCount.set(0); this.toast.push('success', `Enregistré · propagé à ${Math.max(3, n + 2)} modules`); }
  cancel(): void { this.dirtyKeys.clear(); this.dirtyCount.set(0); }

  cellLabel(v: string): string { return v === 'ok' ? 'Oui' : v === 'loc' ? 'Local' : 'Non'; }
}
