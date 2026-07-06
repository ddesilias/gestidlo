import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../ui/toast.service';

declare const L: any;

type ElemType =
  'reservoir' | 'captage' | 'pompe' | 'traitement' |
  'sensor_on' | 'sensor_off' |
  'waterpoint' | 'fontaine' |
  'river' | 'spring' | 'lake' |
  'zone_ok' | 'zone_warn' | 'zone_cut' |
  'alert_crit' | 'alert_warn' |
  'intervention' | 'institution';

interface MapElem {
  id: string; label: string; type: ElemType;
  lat: number; lon: number;
  dept: string; commune?: string;
  linked?: string[];
  detail: Record<string, string>;
}

const ALL_ELEMS: MapElem[] = [
  { id:'R-01', label:'Réservoir Pétion-Ville', type:'reservoir', lat:18.5133, lon:-72.2839, dept:'Ouest', commune:'Pétion-Ville', linked:['C-01','C-02','PE-01','PE-02','zone-pv'],
    detail:{'Type':'Réservoir gravitaire','Capacité':'500 m³','Niveau actuel':'68 %','Pression sortie':'2.8 bar','Débit sortie':'12.4 L/s','Gestionnaire':'DINEPA Ouest','Mise en service':'Jan 2019'} },
  { id:'R-02', label:'Réservoir Gonaïves', type:'reservoir', lat:19.4500, lon:-72.6833, dept:'Artibonite', commune:'Gonaïves', linked:['C-03','PE-05','zone-gon'],
    detail:{'Type':'Réservoir sous pression','Capacité':'300 m³','Niveau actuel':'21 % ⚠','Pression sortie':'0.4 bar','Débit sortie':'2.1 L/s','Gestionnaire':'OREPA Nord-Artibonite','Mise en service':'Sep 2021'} },
  { id:'R-03', label:'Réservoir Cap-Haïtien', type:'reservoir', lat:19.7573, lon:-72.2013, dept:'Nord', commune:'Cap-Haïtien', linked:['C-04','zone-cap'],
    detail:{'Type':'Réservoir gravitaire','Capacité':'800 m³','Niveau actuel':'85 %','Pression sortie':'3.5 bar','Débit sortie':'32.7 L/s','Gestionnaire':'DINEPA Nord','Mise en service':'Juin 2018'} },
  { id:'C-01', label:'Captage Rivière Momance', type:'captage', lat:18.4750, lon:-72.7300, dept:'Ouest', commune:'Léogâne', linked:['R-01','RES-momance'],
    detail:{'Type':'Captage gravitaire','Ressource':'Rivière Momance','Débit capté':'18 L/s','Réservoir alimenté':'R-01','Statut':'En service','Gestionnaire':'DINEPA Ouest'} },
  { id:'C-02', label:'Source Kenscoff', type:'captage', lat:18.4811, lon:-72.2361, dept:'Ouest', commune:'Kenscoff', linked:['R-01','RES-kenscoff'],
    detail:{'Type':'Captage de source','Ressource':'Source Morne Bleu','Débit capté':'15.3 L/s','Réservoir alimenté':'R-01 (appoint)','Statut':'En service','Gestionnaire':'DINEPA Ouest'} },
  { id:'C-03', label:'Prise eau Gonaïves', type:'captage', lat:19.4550, lon:-72.6700, dept:'Artibonite', commune:'Gonaïves', linked:['R-02','RES-artibonite'],
    detail:{'Type':'Prise eau + pompage','Ressource':'Rivière Artibonite','Débit capté':'8 L/s','Réservoir alimenté':'R-02','Statut':'Dégradé ⚠','Gestionnaire':'OREPA Nord-Artibonite'} },
  { id:'C-04', label:'Captage Grande Rivière Nord', type:'captage', lat:19.7800, lon:-72.1900, dept:'Nord', commune:'Grande-Rivière-du-Nord', linked:['R-03','RES-grdn'],
    detail:{'Type':'Captage gravitaire','Ressource':'Grande Rivière du Nord','Débit capté':'35 L/s','Réservoir alimenté':'R-03','Statut':'En service','Gestionnaire':'DINEPA Nord'} },
  { id:'P-01', label:'Station pompage Saint-Marc', type:'pompe', lat:19.1000, lon:-72.7000, dept:'Artibonite', commune:'Saint-Marc', linked:['R-02'],
    detail:{'Type':'Pompe électrique','Puissance':'15 kW','Débit nominal':'20 L/s','Statut':'En service','Gestionnaire':'OREPA Nord-Artibonite','Mise en service':'Juil 2019'} },
  { id:'P-02', label:'Pompe solaire Jérémie', type:'pompe', lat:18.6500, lon:-74.1167, dept:"Grand'Anse", commune:'Jérémie', linked:[],
    detail:{'Type':'Pompe solaire','Puissance':'7.5 kW','Débit nominal':'12 L/s','Statut':'Hors ligne ⚠','Gestionnaire':"DINEPA Grand'Anse",'Mise en service':'Avr 2020'} },
  { id:'PE-01', label:"Point d'eau Pétion-Ville centre", type:'waterpoint', lat:18.5080, lon:-72.2870, dept:'Ouest', commune:'Pétion-Ville', linked:['R-01'],
    detail:{'Type':'Borne-fontaine','Réservoir':'R-01','Service':'Normal','Pression':'2.4 bar','Population':'~1 200 pers.','Responsable':'DINEPA Ouest'} },
  { id:'PE-02', label:'Borne-fontaine Tabarre', type:'fontaine', lat:18.5400, lon:-72.2600, dept:'Ouest', commune:'Tabarre', linked:['R-01'],
    detail:{'Type':'Borne-fontaine','Réservoir':'R-01','Service':'Dégradé ⚠','Pression':'0.9 bar','Population':'~800 pers.','Responsable':'DINEPA Ouest'} },
  { id:'PE-03', label:'Fontaine Source Jacmel', type:'waterpoint', lat:18.2333, lon:-72.5333, dept:'Sud-Est', commune:'Jacmel', linked:['C-02'],
    detail:{'Type':'Borne-fontaine','Réservoir':'Source directe','Service':'Normal','Pression':'1.8 bar','Population':'~500 pers.','Responsable':'DINEPA Sud'} },
  { id:'PE-04', label:"Point d'eau Hinche", type:'waterpoint', lat:19.1500, lon:-72.0333, dept:'Centre', commune:'Hinche', linked:[],
    detail:{'Type':'Borne-fontaine','Réservoir':'Source locale','Service':'Normal','Pression':'2.0 bar','Population':'~700 pers.','Responsable':'DINEPA Centre'} },
  { id:'PE-05', label:"Point d'eau Fort-Liberté", type:'waterpoint', lat:19.6667, lon:-71.8333, dept:'Nord-Est', commune:'Fort-Liberté', linked:[],
    detail:{'Type':'Kiosque eau','Réservoir':'Citerne locale','Service':'Coupure ⛔','Pression':'0 bar','Population':'~400 pers.','Responsable':'DINEPA Nord-Est'} },
  { id:'IOT-01', label:'Capteur R-01 niveau', type:'sensor_on', lat:18.5140, lon:-72.2830, dept:'Ouest', commune:'Pétion-Ville', linked:['R-01'],
    detail:{'Mesure':"Niveau d'eau",'Valeur':'68 %','Dernière trame':'Il y a 5 min','Signal':'Fort','Protocole':'LoRaWAN','Passerelle':'GTW-PAP-01'} },
  { id:'IOT-02', label:'Capteur R-01 pression', type:'sensor_on', lat:18.5120, lon:-72.2850, dept:'Ouest', commune:'Pétion-Ville', linked:['R-01'],
    detail:{'Mesure':'Pression','Valeur':'2.8 bar','Dernière trame':'Il y a 5 min','Signal':'Fort','Protocole':'LoRaWAN','Passerelle':'GTW-PAP-01'} },
  { id:'IOT-03', label:'Capteur C-02 débit', type:'sensor_on', lat:18.4815, lon:-72.2355, dept:'Ouest', commune:'Kenscoff', linked:['C-02'],
    detail:{'Mesure':'Débit','Valeur':'15.3 L/s','Dernière trame':'Il y a 12 min','Signal':'Moyen','Protocole':'LoRaWAN','Passerelle':'GTW-PAP-02'} },
  { id:'IOT-04', label:'Capteur Les Cayes', type:'sensor_on', lat:18.2000, lon:-73.7500, dept:'Sud', commune:'Les Cayes', linked:[],
    detail:{'Mesure':'Débit + niveau','Valeur':'9.8 L/s / 3.6 m','Dernière trame':'Il y a 2 min','Signal':'Fort','Protocole':'GSM','Passerelle':'GTW-CAY-01'} },
  { id:'IOT-05', label:'Capteur Hinche débit', type:'sensor_on', lat:19.1510, lon:-72.0325, dept:'Centre', commune:'Hinche', linked:['PE-04'],
    detail:{'Mesure':'Débit','Valeur':'20.0 L/s','Dernière trame':'Maintenant','Signal':'Fort','Protocole':'LoRaWAN','Passerelle':'GTW-HIN-01'} },
  { id:'IOT-06', label:'Capteur Jacmel source', type:'sensor_on', lat:18.2340, lon:-72.5325, dept:'Sud-Est', commune:'Jacmel', linked:['PE-03'],
    detail:{'Mesure':'Débit','Valeur':'8.4 L/s','Dernière trame':'Il y a 8 min','Signal':'Moyen','Protocole':'LoRaWAN','Passerelle':'GTW-JCM-01'} },
  { id:'IOT-07', label:'Capteur Jérémie hors ligne', type:'sensor_off', lat:18.6510, lon:-74.1155, dept:"Grand'Anse", commune:'Jérémie', linked:['P-02'],
    detail:{'Mesure':'Niveau + pression','Valeur':'—','Dernière trame':'Il y a 6 j','Signal':'Absent','Protocole':'LoRaWAN','Cause':'Panne batterie'} },
  { id:'IOT-08', label:'Capteur Saint-Marc hors ligne', type:'sensor_off', lat:19.1010, lon:-72.6990, dept:'Artibonite', commune:'Saint-Marc', linked:['P-01'],
    detail:{'Mesure':'Débit','Valeur':'—','Dernière trame':'Il y a 2 j','Signal':'Absent','Protocole':'GSM','Cause':'Défaut SIM'} },
  { id:'IOT-09', label:'Capteur Fort-Liberté hors ligne', type:'sensor_off', lat:19.6660, lon:-71.8325, dept:'Nord-Est', commune:'Fort-Liberté', linked:['PE-05'],
    detail:{'Mesure':'Pression','Valeur':'—','Dernière trame':'Il y a 40 min','Signal':'Faible','Protocole':'LoRaWAN','Cause':'Signal faible'} },
  { id:'RES-artibonite', label:'Rivière Artibonite', type:'river', lat:19.1000, lon:-72.5000, dept:'Artibonite', linked:['C-03'],
    detail:{'Type':'Rivière principale','Longueur':'~280 km','Bassin':'Artibonite (~9 000 km²)','AEP':'À étudier','Statut':'Frontalier (RD)'} },
  { id:'RES-momance', label:'Rivière Momance', type:'river', lat:18.4700, lon:-72.7500, dept:'Ouest', commune:'Léogâne', linked:['C-01'],
    detail:{'Type':'Rivière secondaire','Longueur':'~40 km','Bassin':'Ouest','Captage actif':'C-01'} },
  { id:'RES-grdn', label:'Grande Rivière du Nord', type:'river', lat:19.7800, lon:-72.2000, dept:'Nord', linked:['C-04'],
    detail:{'Type':'Rivière principale','Longueur':'~85 km','Bassin':'Nord','Captage actif':'C-04'} },
  { id:'RES-kenscoff', label:'Source Morne Bleu', type:'spring', lat:18.4200, lon:-72.3900, dept:'Ouest', commune:'Kenscoff', linked:['C-02'],
    detail:{'Type':"Source d'altitude",'Régime':'Permanent','Débit':'~15 L/s','AEP':'Exploitable','Captage actif':'C-02','Qualité':'Excellente'} },
  { id:'RES-jacmel', label:'Source Jacmel', type:'spring', lat:18.2330, lon:-72.5330, dept:'Sud-Est', commune:'Jacmel', linked:['IOT-06'],
    detail:{'Type':'Source karstique','Régime':'Permanent','Débit':'~8 L/s','AEP':'Exploitable','Captage':'Directe','Qualité':'Bonne'} },
  { id:'RES-peligre', label:'Lac de Péligre', type:'lake', lat:19.0500, lon:-72.0000, dept:'Centre', commune:'Thomonde', linked:[],
    detail:{'Type':'Lac de barrage','Surface':'~160 km²','Bassin':'Artibonite','AEP':'Exploitable','Usage actuel':'Hydroélectricité'} },
  { id:'zone-pv', label:'Zone Pétion-Ville', type:'zone_ok', lat:18.5050, lon:-72.2750, dept:'Ouest', commune:'Pétion-Ville', linked:['R-01','PE-01'],
    detail:{'Statut service':'Normal','Population':'~18 000 pers.',"Points d'eau actifs":'4','Réservoir':'R-01','Responsable':'DINEPA Ouest','Couverture':'92 %'} },
  { id:'zone-tab', label:'Zone Tabarre', type:'zone_warn', lat:18.5400, lon:-72.2550, dept:'Ouest', commune:'Tabarre', linked:['R-01','PE-02'],
    detail:{'Statut service':'Dégradé ⚠','Population':'~12 000 pers.',"Points d'eau actifs":'2 / 4','Réservoir':'R-01','Responsable':'DINEPA Ouest','Couverture':'48 %'} },
  { id:'zone-gon', label:'Zone Gonaïves', type:'zone_warn', lat:19.4450, lon:-72.6900, dept:'Artibonite', commune:'Gonaïves', linked:['R-02'],
    detail:{'Statut service':'Dégradé ⚠','Population':'~22 000 pers.',"Points d'eau actifs":'3 / 8','Réservoir':'R-02 (21 %)','Responsable':'OREPA Nord-Artibonite','Couverture':'35 %'} },
  { id:'zone-fl', label:'Zone Fort-Liberté', type:'zone_cut', lat:19.6620, lon:-71.8400, dept:'Nord-Est', commune:'Fort-Liberté', linked:['PE-05'],
    detail:{'Statut service':'Coupure ⛔','Population':'~5 000 pers.',"Points d'eau actifs":'0 / 2','Cause':'Pompe hors service','Responsable':'DINEPA Nord-Est','Depuis':'48 h','Technicien':'Non assigné'} },
  { id:'zone-cap', label:'Zone Cap-Haïtien', type:'zone_ok', lat:19.7520, lon:-72.2100, dept:'Nord', commune:'Cap-Haïtien', linked:['R-03'],
    detail:{'Statut service':'Normal','Population':'~35 000 pers.',"Points d'eau actifs":'6','Réservoir':'R-03 (85 %)','Responsable':'DINEPA Nord','Couverture':'87 %'} },
  { id:'ALT-001', label:'Niveau critique Gonaïves', type:'alert_crit', lat:19.4520, lon:-72.6820, dept:'Artibonite', commune:'Gonaïves', linked:['R-02'],
    detail:{'Gravité':'Critique','Ouvrage':'R-02 — Réservoir Gonaïves','Cause':'Niveau < 25 % seuil critique','Déclenché':'Il y a 3 h','Responsable':'OREPA Nord-Artibonite','Technicien':'Non assigné','Population':'~22 000 pers.','Statut':'Ouvert'} },
  { id:'ALT-002', label:'Coupure Fort-Liberté', type:'alert_crit', lat:19.6650, lon:-71.8350, dept:'Nord-Est', commune:'Fort-Liberté', linked:['PE-05'],
    detail:{'Gravité':'Critique','Ouvrage':"PE-05 — Point d'eau Fort-Liberté",'Cause':'Pression nulle — coupure totale','Déclenché':'Il y a 2 j','Responsable':'DINEPA Nord-Est','Technicien':'Non assigné','Population':'~5 000 pers.','Statut':'Ouvert'} },
  { id:'ALT-003', label:'Niveau bas Pétion-Ville', type:'alert_warn', lat:18.5125, lon:-72.2845, dept:'Ouest', commune:'Pétion-Ville', linked:['R-01'],
    detail:{'Gravité':'Avertissement','Ouvrage':'R-01 — Réservoir Pétion-Ville','Cause':'Niveau < 70 %','Déclenché':'Il y a 45 min','Responsable':'DINEPA Ouest','Technicien':'Frantz Joseph','Statut':'En cours'} },
  { id:'ALT-004', label:'Capteur hors ligne Jérémie', type:'alert_warn', lat:18.6515, lon:-74.1160, dept:"Grand'Anse", commune:'Jérémie', linked:['IOT-07','P-02'],
    detail:{'Gravité':'Avertissement','Ouvrage':'IOT-07 + P-02 — Jérémie','Cause':'Capteur hors ligne depuis 6 jours','Déclenché':'Il y a 6 j','Responsable':"DINEPA Grand'Anse",'Technicien':'Non assigné','Statut':'Ouvert'} },
  { id:'INT-01', label:'Maintenance pompe Saint-Marc', type:'intervention', lat:19.1020, lon:-72.7010, dept:'Artibonite', commune:'Saint-Marc', linked:['P-01'],
    detail:{'Type':'Maintenance préventive','Ouvrage':'P-01 — Station Saint-Marc','Technicien':'Gérald Baptiste','Début':"Aujourd'hui 08:00",'État':'En cours','Institution':'OREPA Nord-Artibonite'} },
  { id:'INT-02', label:'Inspection captage Momance', type:'intervention', lat:18.4760, lon:-72.7290, dept:'Ouest', commune:'Léogâne', linked:['C-01'],
    detail:{'Type':'Inspection terrain','Ouvrage':'C-01 — Captage Momance','Technicien':'Pierre Nazaire','Début':'Hier 14:00','État':'Terminée','Institution':'DINEPA Ouest'} },
  { id:'INST-dinepa-ouest', label:'DINEPA Ouest', type:'institution', lat:18.5420, lon:-72.3380, dept:'Ouest',
    detail:{'Territoire':'Département Ouest','Responsables':'4','Techniciens':'12','Ouvrages gérés':'18','Zones couvertes':'7','Zones sans responsable':'2'} },
  { id:'INST-orepa-na', label:'OREPA Nord-Artibonite', type:'institution', lat:19.4500, lon:-72.6750, dept:'Artibonite',
    detail:{'Territoire':'Artibonite','Responsables':'2','Techniciens':'7','Ouvrages gérés':'9','Zones couvertes':'3','Zones sans responsable':'1'} },
];

@Component({
  selector: 'app-supervision-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
<div class="sp">

  <!-- ── Top bar ── -->
  <header class="sp-top">
    <button class="sp-top__menu">
      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
    <div class="sp-top__center">
      <div class="sp-top__title">SUPERVISION OREPA SUD</div>
      <div class="sp-top__sub">Zone Jacmel · {{ cntAll }} points · suivi en direct</div>
    </div>
    <div class="sp-top__right">
      <button class="sp-top__bell" (click)="showTasksPanel = !showTasksPanel">
        <svg width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        <span class="sp-top__badge">{{ cntUrgent + 2 }}</span>
      </button>
      <div class="sp-top__user">
        <div class="sp-top__avatar">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div>
          <div class="sp-top__uname">Superviseur</div>
          <div class="sp-top__urole">OREPA Sud</div>
        </div>
      </div>
    </div>
  </header>

  <!-- ── Layout ── -->
  <div class="sp-layout">

    <!-- Left sidebar -->
    <aside class="sp-side">

      <!-- Search -->
      <div class="sp-search-wrap">
        <div class="sp-search" [class.sp-search--active]="showSearchDrop">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="sp-search__icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="sp-search__input" [(ngModel)]="searchQuery" placeholder="Aller à une commune, section..."
            (focus)="showSearchDrop=true" (blur)="onSearchBlur()" (ngModelChange)="onSearchChange()" autocomplete="off">
          <button *ngIf="searchQuery" class="sp-search__clear" type="button" (click)="clearSearch()">×</button>
          <div class="sp-search-drop" *ngIf="showSearchDrop && searchResults().length > 0">
            <div class="sp-search-item" *ngFor="let r of searchResults()" (mousedown)="selectSearchResult(r)">
              <span class="sp-search-dot" [style.background]="elemColor(r.type)"></span>
              <div>
                <div class="sp-search-item__lbl">{{ r.label }}</div>
                <div class="sp-search-item__sub">{{ typeLabel(r.type) }}<ng-container *ngIf="r.commune"> · {{ r.commune }}</ng-container></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tasks panel -->
      <div class="sp-tasks">
        <div class="sp-tasks__head">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          <span>CE QUI VOUS ATTEND</span>
          <span class="sp-tasks__cnt">{{ cntUrgent + 2 }}</span>
        </div>
        <div class="sp-task sp-task--red" (click)="goAlerts()">
          <div class="sp-task__icon sp-task__icon--red">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div class="sp-task__body">
            <div class="sp-task__label">{{ cntUrgent }} alerte{{ cntUrgent > 1 ? 's' : '' }} à traiter</div>
            <div class="sp-task__sub sp-task__sub--red">dont {{ unassignedCount }} urgente · ~{{ urgentPop }} foyers</div>
          </div>
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:#6B7785;flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="sp-task sp-task--amber">
          <div class="sp-task__icon sp-task__icon--amber">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div class="sp-task__body">
            <div class="sp-task__label">2 rapports à valider</div>
            <div class="sp-task__sub sp-task__sub--amber">soumis par Jean P. et Maria C.</div>
          </div>
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:#6B7785;flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>

      <!-- Filters -->
      <div class="sp-filters">
        <div class="sp-filters__head">
          <span>FILTRER LA CARTE</span>
          <button class="sp-filters__reset" type="button" (click)="setFilter('all')" title="Réinitialiser">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
          </button>
        </div>
        <p class="sp-filters__hint">Touchez un filtre pour n'afficher que ces points.</p>

        <div class="sp-filter" [class.sp-filter--on]="activeFilter==='all'" (click)="setFilter('all')">
          <div class="sp-filter__ico sp-filter__ico--green"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div>
          <span class="sp-filter__lbl">Tout afficher</span>
          <span class="sp-filter__cnt sp-filter__cnt--green">{{ cntAll }}</span>
        </div>
        <div class="sp-filter" [class.sp-filter--on]="activeFilter==='urgent'" (click)="setFilter('urgent')">
          <div class="sp-filter__ico sp-filter__ico--red"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg></div>
          <span class="sp-filter__lbl">Problèmes urgents</span>
          <span class="sp-filter__cnt sp-filter__cnt--red">{{ cntUrgent }}</span>
        </div>
        <div class="sp-filter" [class.sp-filter--on]="activeFilter==='maintenance'" (click)="setFilter('maintenance')">
          <div class="sp-filter__ico sp-filter__ico--amber"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg></div>
          <span class="sp-filter__lbl">En maintenance</span>
          <span class="sp-filter__cnt sp-filter__cnt--amber">{{ cntMaint }}</span>
        </div>
        <div class="sp-filter" [class.sp-filter--on]="activeFilter==='tech'" (click)="setFilter('tech')">
          <div class="sp-filter__ico sp-filter__ico--blue"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
          <span class="sp-filter__lbl">Techniciens sur place</span>
          <span class="sp-filter__cnt sp-filter__cnt--blue">{{ cntTech }}</span>
        </div>
        <div class="sp-filter" [class.sp-filter--on]="activeFilter==='ok'" (click)="setFilter('ok')">
          <div class="sp-filter__ico sp-filter__ico--green"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
          <span class="sp-filter__lbl">Tout va bien</span>
          <span class="sp-filter__cnt sp-filter__cnt--green">{{ cntOk }}</span>
        </div>

        <!-- Legend -->
        <div class="sp-legend-wrap">
          <div class="sp-legend__head" (click)="showLegend = !showLegend">
            <span>Légende</span>
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
                 [style.transform]="showLegend ? 'rotate(180deg)' : ''">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
          <div *ngIf="showLegend" class="sp-legend-items">
            <div class="sp-legend-item"><span class="sp-legend-dot" style="background:#10B981"></span><span>Fonctionne normalement</span></div>
            <div class="sp-legend-item"><span class="sp-legend-dot" style="background:#F59E0B"></span><span>À surveiller</span></div>
            <div class="sp-legend-item"><span class="sp-legend-dot" style="background:#EF4444"></span><span>Problème urgent</span></div>
            <div class="sp-legend-item"><span class="sp-legend-dot" style="background:#3B82F6"></span><span>Technicien en intervention</span></div>
          </div>
        </div>
      </div>

      <!-- Foot -->
      <div class="sp-side-foot">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:#34D399;flex-shrink:0"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.63a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
        <div>
          Rapports transmis à DINEPA<br>
          <strong style="color:#34D399">À jour · 17 mai 09:15</strong>
        </div>
      </div>

    </aside>

    <!-- Map area -->
    <div class="sp-map-area" (click)="onMapAreaClick($event)">
      <div #mapEl class="sp-map-canvas"></div>

      <!-- Urgent banner -->
      <div class="sp-banner" *ngIf="urgentBannerText()">
        <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>
        {{ urgentBannerText() }}
      </div>

      <!-- FAB -->
      <div class="sp-fab">
        <div class="sp-fab__items" *ngIf="showFabMenu">
          <div class="sp-fab__row">
            <span class="sp-fab__lbl">Recenser une ressource</span>
            <button class="sp-fab__btn sp-fab__btn--green" type="button" (click)="recenserRessource()">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>
            </button>
          </div>
          <div class="sp-fab__row">
            <span class="sp-fab__lbl">Enregistrer un ouvrage</span>
            <button class="sp-fab__btn sp-fab__btn--amber" type="button" (click)="enregistrerOuvrage()">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </button>
          </div>
          <div class="sp-fab__row">
            <span class="sp-fab__lbl">Signaler une anomalie</span>
            <button class="sp-fab__btn sp-fab__btn--red" type="button" (click)="signalerAnomalie()">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </button>
          </div>
        </div>
        <button class="sp-fab__main" type="button" (click)="showFabMenu = !showFabMenu">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ajouter
        </button>
      </div>

      <!-- Locate button -->
      <button class="sp-locate" type="button" (click)="recenterHaiti()">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:#2563EB"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
        Où suis-je ?
      </button>

      <!-- Right drawer -->
      <div class="sp-drawer" [class.sp-drawer--open]="selectedElem !== null">
        <ng-container *ngIf="selectedElem as e">

          <div class="sp-drawer__head">
            <div class="sp-drawer__type">
              <div class="sp-drawer__type-ico" [style.background]="elemColor(e.type)+'22'" [style.color]="elemColor(e.type)">
                <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>
              </div>
              <span class="sp-drawer__type-lbl" [style.color]="elemColor(e.type)">Point sélectionné</span>
            </div>
            <button class="sp-drawer__close" type="button" (click)="closeDetail()">
              <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div class="sp-drawer__body">
            <h3 class="sp-drawer__title">{{ e.label }}</h3>
            <div class="sp-drawer__sub">{{ e.dept.toUpperCase() }}<ng-container *ngIf="e.commune"> · {{ e.commune.toUpperCase() }}</ng-container> · {{ typeLabel(e.type).toUpperCase() }}</div>

            <span class="sp-drawer__status" [style.background]="elemColor(e.type)+'22'" [style.color]="elemColor(e.type)">
              <span class="sp-drawer__status-dot" [style.background]="elemColor(e.type)"></span>
              {{ drawerStatusLabel(e) }}
            </span>

            <!-- Impact block for alerts -->
            <div class="sp-drawer__impact" *ngIf="e.detail['Population']"
                 [style.background]="'rgba(239,68,68,.06)'" [style.border]="'1px solid rgba(239,68,68,.25)'">
              <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" [style.color]="elemColor(e.type)"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              <div>
                <div class="sp-drawer__impact-count" [style.color]="elemColor(e.type)">{{ e.detail['Population'] }}</div>
                <div class="sp-drawer__impact-desc">{{ e.detail['Cause'] || e.detail['Statut'] || '' }}<ng-container *ngIf="e.detail['Technicien']"> · {{ e.detail['Technicien'] }}</ng-container></div>
              </div>
            </div>

            <!-- Primary action -->
            <a class="sp-drawer__btn-primary" [routerLink]="detailRoute(e)">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Voir le détail complet
            </a>

            <!-- Priority action -->
            <div class="sp-drawer__priority" *ngIf="showPriorityAction(e)">
              <div class="sp-drawer__priority-lbl">Action prioritaire</div>
              <button class="sp-drawer__priority-btn" type="button" (click)="assignTech()">
                <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                Envoyer un technicien maintenant
              </button>
            </div>

            <!-- Other actions -->
            <div class="sp-drawer__other-wrap">
              <div class="sp-drawer__other-lbl">Autres actions</div>
              <button class="sp-drawer__other-btn" type="button" (click)="changerEtat()">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:#FBBF24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                Changer l'état de l'ouvrage
              </button>
              <button class="sp-drawer__other-btn" type="button" (click)="voirHistorique()">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:#A5A4DC"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Historique des interventions
              </button>
              <button class="sp-drawer__other-btn" type="button" (click)="voirChaine()">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:#34D399"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Voir la chaîne d'exploitation
              </button>
              <button class="sp-drawer__other-btn" type="button" routerLink="/gouvernance/territoire">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:#A5A4DC"><circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 00-8 8c0 5.25 7 12 8 12s8-6.75 8-12a8 8 0 00-8-8z"/></svg>
                Fiche territoire ({{ e.commune || e.dept }})
              </button>
            </div>
          </div>

          <div class="sp-drawer__foot">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:#60A5FA;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Toute action est tracée et remonte automatiquement à DINEPA
          </div>

        </ng-container>
      </div><!-- /drawer -->

    </div><!-- /map area -->
  </div><!-- /layout -->
</div>
  `,
  styles: [`
    :host { display:flex; flex-direction:column; height:calc(100vh - 64px); overflow:hidden; }
    .sp { display:flex; flex-direction:column; height:100%; background:#0F1419; color:#E2E8EE; font-family:-apple-system,system-ui,sans-serif; }

    /* Top bar */
    .sp-top { background:linear-gradient(to right,#1D4ED8,#2563EB); padding:14px 20px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }
    .sp-top__menu { background:rgba(255,255,255,.15); border:none; color:#fff; width:42px; height:42px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .sp-top__center { text-align:center; }
    .sp-top__title { font-size:18px; color:#fff; font-weight:700; letter-spacing:.5px; }
    .sp-top__sub { font-size:11px; color:rgba(255,255,255,.8); }
    .sp-top__right { display:flex; align-items:center; gap:12px; }
    .sp-top__bell { position:relative; background:rgba(255,255,255,.15); border:none; color:#fff; width:42px; height:42px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .sp-top__badge { position:absolute; top:-4px; right:-4px; width:20px; height:20px; background:#EF4444; color:#fff; border-radius:50%; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; border:2px solid #2563EB; }
    .sp-top__user { display:flex; align-items:center; gap:8px; }
    .sp-top__avatar { width:38px; height:38px; background:rgba(255,255,255,.2); border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; }
    .sp-top__uname { font-size:12px; color:#fff; font-weight:600; }
    .sp-top__urole { font-size:10px; color:rgba(255,255,255,.7); }

    /* Layout */
    .sp-layout { display:grid; grid-template-columns:300px 1fr; flex:1; overflow:hidden; }

    /* Sidebar */
    .sp-side { background:#161E28; border-right:1px solid #1F2A33; display:flex; flex-direction:column; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#1F2A33 transparent; }

    .sp-search-wrap { padding:18px 18px 14px; border-bottom:1px solid #1F2A33; }
    .sp-search { position:relative; display:flex; align-items:center; gap:6px; }
    .sp-search__icon { position:absolute; left:14px; top:50%; transform:translateY(-50%); color:#6B7785; z-index:1; }
    .sp-search__input { width:100%; background:#0F1419; border:1.5px solid #2A3744; color:#E2E8EE; padding:13px 14px 13px 42px; border-radius:24px; font-size:13px; box-sizing:border-box; outline:none; transition:border-color .15s; }
    .sp-search__input::placeholder { color:#6B7785; }
    .sp-search--active .sp-search__input { border-color:#3B82F6; }
    .sp-search__clear { position:absolute; right:14px; background:none; border:none; color:#6B7785; cursor:pointer; font-size:18px; line-height:1; }
    .sp-search-drop { position:absolute; top:calc(100% + 6px); left:0; right:0; background:#161E28; border:1px solid #1F2A33; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.4); z-index:1000; overflow:hidden; }
    .sp-search-item { display:flex; align-items:center; gap:10px; padding:10px 14px; cursor:pointer; border-bottom:1px solid #1F2A33; }
    .sp-search-item:last-child { border-bottom:0; }
    .sp-search-item:hover { background:#1F2A33; }
    .sp-search-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .sp-search-item__lbl { font-size:12px; font-weight:600; color:#F5F7FA; }
    .sp-search-item__sub { font-size:10px; color:#8B9AAB; }

    .sp-tasks { padding:16px 18px; border-bottom:1px solid #1F2A33; background:rgba(245,158,11,.04); }
    .sp-tasks__head { display:flex; align-items:center; gap:8px; margin-bottom:12px; font-size:12px; color:#FBBF24; font-weight:700; letter-spacing:.3px; }
    .sp-tasks__cnt { margin-left:auto; font-size:11px; background:rgba(245,158,11,.15); padding:2px 8px; border-radius:999px; font-weight:700; }
    .sp-task { display:flex; align-items:center; gap:10px; padding:10px; border-radius:10px; cursor:pointer; margin-bottom:7px; transition:opacity .15s; }
    .sp-task:last-child { margin-bottom:0; }
    .sp-task:hover { opacity:.9; }
    .sp-task--red   { background:#0F1419; border:1px solid rgba(239,68,68,.25); }
    .sp-task--amber { background:#0F1419; border:1px solid rgba(245,158,11,.25); }
    .sp-task__icon { width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .sp-task__icon--red   { background:rgba(239,68,68,.15); color:#F87171; }
    .sp-task__icon--amber { background:rgba(245,158,11,.15); color:#FBBF24; }
    .sp-task__body { flex:1; }
    .sp-task__label { font-size:11px; font-weight:600; color:#F5F7FA; }
    .sp-task__sub { font-size:9px; margin-top:2px; }
    .sp-task__sub--red   { color:#FCA5A5; }
    .sp-task__sub--amber { color:#FCD34D; }

    .sp-filters { padding:16px 18px; flex:1; }
    .sp-filters__head { display:flex; align-items:center; font-size:12px; color:#60A5FA; font-weight:700; letter-spacing:.3px; margin-bottom:6px; }
    .sp-filters__reset { margin-left:auto; background:none; border:none; color:#60A5FA; cursor:pointer; display:flex; }
    .sp-filters__hint { font-size:10px; color:#8B9AAB; margin:0 0 14px; line-height:1.5; }
    .sp-filter { display:flex; align-items:center; gap:11px; padding:11px 10px; border-radius:10px; cursor:pointer; margin-bottom:4px; transition:background .15s; border:1px solid transparent; }
    .sp-filter:hover { background:#1A2530; }
    .sp-filter--on { background:rgba(16,185,129,.1); border-color:rgba(16,185,129,.3); }
    .sp-filter__ico { width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .sp-filter__ico--green { background:rgba(16,185,129,.15); color:#34D399; }
    .sp-filter__ico--red   { background:rgba(239,68,68,.15);  color:#F87171; }
    .sp-filter__ico--amber { background:rgba(245,158,11,.15); color:#FBBF24; }
    .sp-filter__ico--blue  { background:rgba(59,130,246,.15); color:#60A5FA; }
    .sp-filter__lbl { flex:1; font-size:12px; color:#E2E8EE; font-weight:500; }
    .sp-filter__cnt { font-size:11px; font-weight:700; }
    .sp-filter__cnt--green { color:#34D399; }
    .sp-filter__cnt--red   { color:#F87171; }
    .sp-filter__cnt--amber { color:#FBBF24; }
    .sp-filter__cnt--blue  { color:#60A5FA; }

    .sp-legend-wrap { border-top:1px solid #1F2A33; padding-top:12px; margin-top:8px; }
    .sp-legend__head { display:flex; align-items:center; justify-content:space-between; cursor:pointer; font-size:12px; color:#CBD5E1; font-weight:600; padding:4px 0; }
    .sp-legend__head svg { transition:transform .15s; }
    .sp-legend-items { margin-top:9px; display:flex; flex-direction:column; gap:7px; }
    .sp-legend-item { display:flex; align-items:center; gap:8px; font-size:10px; color:#8B9AAB; }
    .sp-legend-dot { width:11px; height:11px; border-radius:50%; flex-shrink:0; }

    .sp-side-foot { padding:12px 18px; border-top:1px solid #1F2A33; background:#0A0E12; display:flex; align-items:center; gap:8px; font-size:9px; color:#6B7785; line-height:1.4; flex-shrink:0; }

    /* Map area */
    .sp-map-area { position:relative; overflow:hidden; }
    .sp-map-canvas { position:absolute; inset:0; }

    /* Alert banner */
    .sp-banner { position:absolute; top:16px; left:50%; transform:translateX(-50%); z-index:600; background:rgba(239,68,68,.95); color:#fff; padding:8px 18px; border-radius:24px; font-size:12px; font-weight:600; box-shadow:0 4px 14px rgba(239,68,68,.4); display:flex; align-items:center; gap:8px; white-space:nowrap; pointer-events:none; }

    /* FAB */
    .sp-fab { position:absolute; bottom:24px; right:24px; z-index:600; display:flex; flex-direction:column; gap:10px; align-items:flex-end; }
    .sp-fab__items { display:flex; flex-direction:column; gap:8px; align-items:flex-end; }
    .sp-fab__row { display:flex; align-items:center; gap:10px; }
    .sp-fab__lbl { background:#0F1419; color:#E2E8EE; padding:7px 12px; border-radius:8px; font-size:11px; font-weight:500; box-shadow:0 2px 8px rgba(0,0,0,.4); white-space:nowrap; }
    .sp-fab__btn { width:46px; height:46px; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .sp-fab__btn--green { background:#10B981; color:#fff; box-shadow:0 4px 14px rgba(16,185,129,.4); }
    .sp-fab__btn--amber { background:#F59E0B; color:#0F1419; box-shadow:0 4px 14px rgba(245,158,11,.4); }
    .sp-fab__btn--red   { background:#EF4444; color:#fff; box-shadow:0 4px 14px rgba(239,68,68,.4); }
    .sp-fab__main { background:#2563EB; border:none; color:#fff; padding:15px 24px; border-radius:30px; font-size:15px; font-weight:700; cursor:pointer; box-shadow:0 6px 20px rgba(37,99,235,.5); display:flex; align-items:center; gap:8px; }
    .sp-fab__main:hover { background:#1D4ED8; }

    /* Locate */
    .sp-locate { position:absolute; bottom:24px; left:20px; z-index:600; background:rgba(255,255,255,.95); border:none; color:#1f2937; padding:11px 18px; border-radius:24px; font-size:12px; font-weight:600; cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,.2); display:flex; align-items:center; gap:7px; }
    .sp-locate:hover { background:#fff; }

    /* Drawer */
    .sp-drawer { position:absolute; top:0; right:0; bottom:0; width:380px; background:#161E28; border-left:1px solid #1F2A33; box-shadow:-8px 0 30px rgba(0,0,0,.45); display:flex; flex-direction:column; transform:translateX(100%); transition:transform .25s cubic-bezier(.4,0,.2,1); z-index:700; }
    .sp-drawer--open { transform:translateX(0); }

    .sp-drawer__head { padding:16px 20px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #1F2A33; flex-shrink:0; }
    .sp-drawer__type { display:flex; align-items:center; gap:8px; }
    .sp-drawer__type-ico { width:32px; height:32px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .sp-drawer__type-lbl { font-size:12px; font-weight:600; }
    .sp-drawer__close { background:transparent; border:none; color:#8B9AAB; cursor:pointer; display:flex; align-items:center; padding:4px; }
    .sp-drawer__close:hover { color:#E2E8EE; }

    .sp-drawer__body { flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:0; }
    .sp-drawer__title { margin:0 0 6px; font-size:21px; color:#F5F7FA; font-weight:700; line-height:1.2; }
    .sp-drawer__sub { font-size:12px; color:#8B9AAB; margin-bottom:12px; letter-spacing:.3px; }
    .sp-drawer__status { display:inline-flex; align-items:center; gap:6px; font-size:12px; padding:5px 14px; border-radius:999px; font-weight:600; margin-bottom:16px; }
    .sp-drawer__status-dot { width:7px; height:7px; border-radius:50%; }

    .sp-drawer__impact { border-radius:12px; padding:13px; margin-bottom:16px; display:flex; align-items:center; gap:10px; }
    .sp-drawer__impact-count { font-size:17px; font-weight:700; }
    .sp-drawer__impact-desc { font-size:10px; color:#8B9AAB; margin-top:2px; }

    .sp-drawer__btn-primary { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; background:#2563EB; border:none; color:#fff; padding:15px; border-radius:30px; font-size:15px; font-weight:600; cursor:pointer; margin-bottom:10px; text-decoration:none; }
    .sp-drawer__btn-primary:hover { background:#1D4ED8; }

    .sp-drawer__priority { background:rgba(239,68,68,.06); border:1px solid rgba(239,68,68,.25); border-radius:12px; padding:12px; margin-bottom:14px; }
    .sp-drawer__priority-lbl { font-size:11px; color:#FCA5A5; font-weight:600; margin-bottom:8px; text-transform:uppercase; letter-spacing:.3px; }
    .sp-drawer__priority-btn { width:100%; background:#EF4444; border:none; color:#fff; padding:14px; border-radius:24px; font-size:14px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; }
    .sp-drawer__priority-btn:hover { background:#DC2626; }

    .sp-drawer__other-wrap { border-top:1px solid #1F2A33; padding-top:14px; }
    .sp-drawer__other-lbl { font-size:11px; color:#8B9AAB; font-weight:600; text-transform:uppercase; letter-spacing:.3px; margin-bottom:10px; }
    .sp-drawer__other-btn { width:100%; background:#1A2530; border:1.5px solid #2A3744; color:#E2E8EE; padding:13px; border-radius:22px; font-size:13px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:10px; margin-bottom:8px; text-align:left; text-decoration:none; }
    .sp-drawer__other-btn:hover { background:#1F2A33; }

    .sp-drawer__foot { padding:12px 20px; background:#0A0E12; border-top:1px solid #1F2A33; display:flex; align-items:center; gap:8px; font-size:10px; color:#8B9AAB; flex-shrink:0; }

    @keyframes sp-pulse {
      0%,100% { transform:scale(1); opacity:.4; }
      50% { transform:scale(1.8); opacity:0; }
    }
  `]
})
export class SupervisionPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) private readonly mapElRef?: ElementRef<HTMLDivElement>;

  activeFilter: 'all' | 'urgent' | 'maintenance' | 'tech' | 'ok' = 'all';
  showFabMenu = false;
  showLegend = false;
  showTasksPanel = false;
  showSearchDrop = false;
  searchQuery = '';
  selectedElem: MapElem | null = null;

  private map?: any;
  private markerGroup?: any;
  private readonly markerMap = new Map<string, any>();
  private searchBlurTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly ngZone: NgZone, readonly toast: ToastService) {}

  /* ── KPI getters ─────────────────────────────────────────────── */
  get cntAll()      { return ALL_ELEMS.length; }
  get cntUrgent()   { return ALL_ELEMS.filter(e => ['alert_crit','alert_warn','zone_cut'].includes(e.type)).length; }
  get cntMaint()    { return ALL_ELEMS.filter(e => ['sensor_off','zone_warn','pompe'].includes(e.type)).length; }
  get cntTech()     { return ALL_ELEMS.filter(e => e.type === 'intervention').length; }
  get cntOk()       { return ALL_ELEMS.filter(e => ['zone_ok','sensor_on'].includes(e.type)).length; }
  get unassignedCount() { return ALL_ELEMS.filter(e => e.type === 'alert_crit' && e.detail['Technicien'] === 'Non assigné').length; }
  get urgentPop()   { return '27 200'; }

  urgentBannerText(): string | null {
    const u = ALL_ELEMS.filter(e => e.type === 'alert_crit' && e.detail['Technicien'] === 'Non assigné');
    if (!u.length) return null;
    return `${u.length} urgence${u.length > 1 ? 's' : ''} non assignée${u.length > 1 ? 's' : ''} — ${u[0].label}`;
  }

  drawerStatusLabel(e: MapElem): string {
    const m: Record<string, string> = {
      alert_crit:'ALERTE CRITIQUE', alert_warn:'ALERTE MODÉRÉE',
      zone_cut:'COUPURE TOTALE', zone_warn:'SERVICE DÉGRADÉ',
      intervention:'INTERVENTION EN COURS', sensor_off:'HORS LIGNE',
    };
    return m[e.type] ?? 'EN SERVICE';
  }

  showPriorityAction(e: MapElem): boolean {
    return ['alert_crit','zone_cut'].includes(e.type) && e.detail['Technicien'] === 'Non assigné';
  }

  /* ── Filter ──────────────────────────────────────────────────── */
  setFilter(f: string): void {
    this.activeFilter = f as any;
    this.rebuildMarkers();
  }

  private getVisibleTypes(): Set<ElemType> | null {
    switch (this.activeFilter) {
      case 'urgent':      return new Set<ElemType>(['alert_crit','alert_warn','zone_cut','zone_warn']);
      case 'maintenance': return new Set<ElemType>(['sensor_off','zone_warn','pompe']);
      case 'tech':        return new Set<ElemType>(['intervention']);
      case 'ok':          return new Set<ElemType>(['zone_ok','sensor_on','waterpoint','fontaine','reservoir','captage']);
      default:            return null;
    }
  }

  /* ── FAB actions ─────────────────────────────────────────────── */
  recenserRessource(): void { this.showFabMenu=false; this.toast.push('info','Recenser une ressource — disponible dans Gouvernance > Ressources'); }
  enregistrerOuvrage(): void { this.showFabMenu=false; this.toast.push('info','Enregistrer un ouvrage — disponible dans Gouvernance > Infrastructures'); }
  signalerAnomalie(): void { this.showFabMenu=false; this.toast.push('info','Signaler une anomalie — disponible dans Alertes'); }
  assignTech(): void { this.toast.push('success','Technicien assigné — notification envoyée au responsable OREPA'); }
  changerEtat(): void { this.toast.push('info','Changement d\'état — disponible dans la fiche détaillée'); }
  voirHistorique(): void { this.toast.push('info','Historique des interventions — disponible dans la fiche'); }
  voirChaine(): void { this.toast.push('info','Chaîne d\'exploitation — voir la fiche infrastructure'); }
  goAlerts(): void { this.toast.push('info','Navigation vers Alertes'); }

  onMapAreaClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).closest('.sp-drawer') || (e.target as HTMLElement).closest('.sp-fab') || (e.target as HTMLElement).closest('.sp-locate') || (e.target as HTMLElement).closest('.sp-banner')) return;
    if (this.showFabMenu) this.showFabMenu = false;
  }

  /* ── Leaflet ─────────────────────────────────────────────────── */
  ngAfterViewInit(): void {
    if (typeof L === 'undefined' || !this.mapElRef?.nativeElement) return;
    this.map = L.map(this.mapElRef.nativeElement, { zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this.map);
    this.map.fitBounds(L.latLngBounds([17.9, -74.6], [20.1, -71.6]), { padding: [20, 20] });
    this.markerGroup = L.layerGroup().addTo(this.map);
    this.rebuildMarkers();
  }

  ngOnDestroy(): void {
    try { this.map?.remove(); } catch { /* ignore */ }
    clearTimeout(this.searchBlurTimer);
  }

  rebuildMarkers(): void {
    if (!this.map || !this.markerGroup) return;
    this.markerGroup.clearLayers();
    this.markerMap.clear();

    const visibleTypes = this.getVisibleTypes();
    const q = this.searchQuery.length >= 2 ? this.searchQuery.toLowerCase() : null;

    for (const e of ALL_ELEMS) {
      if (!Number.isFinite(e.lat) || !Number.isFinite(e.lon)) continue;
      if (visibleTypes && !visibleTypes.has(e.type)) continue;
      if (q) {
        const hit = e.label.toLowerCase().includes(q) || (e.commune ?? '').toLowerCase().includes(q) || e.dept.toLowerCase().includes(q);
        if (!hit) continue;
      }

      const color = this.elemColor(e.type);
      const size = this.elemSize(e.type);
      const isSelected = e.id === this.selectedElem?.id;
      const isPulse = e.type === 'alert_crit' || e.type === 'intervention';
      const pulseRing = isPulse ? `<div style="position:absolute;inset:-7px;border-radius:50%;background:${color};opacity:.35;animation:sp-pulse 1.8s infinite ease-out"></div>` : '';
      const selStyle = isSelected ? `box-shadow:0 0 0 4px ${color}55;transform:scale(1.5);` : '';

      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:${size+14}px;height:${size+14}px;display:flex;align-items:center;justify-content:center">${pulseRing}<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);${selStyle}transition:transform .2s"></div></div>`,
        iconSize: [size+14, size+14],
        iconAnchor: [Math.round((size+14)/2), Math.round((size+14)/2)]
      });

      const marker = L.marker([e.lat, e.lon], { icon });
      marker.bindTooltip(`<strong>${e.label}</strong><br><small style="color:#6B7785">${this.typeLabel(e.type)} · ${e.dept}</small>`, { direction: 'top' });
      marker.on('click', () => this.ngZone.run(() => this.selectElem(e.id)));
      marker.addTo(this.markerGroup);
      this.markerMap.set(e.id, marker);
    }
  }

  recenterHaiti(): void {
    if (this.map) this.map.fitBounds(L.latLngBounds([17.9, -74.6], [20.1, -71.6]), { padding: [20, 20], animate: true });
  }

  selectElem(id: string): void {
    this.selectedElem = ALL_ELEMS.find(x => x.id === id) ?? null;
    this.rebuildMarkers();
    if (this.selectedElem?.lat && this.map) {
      this.map.panTo([this.selectedElem.lat, this.selectedElem.lon], { animate: true });
    }
  }

  closeDetail(): void {
    this.selectedElem = null;
    this.rebuildMarkers();
  }

  /* ── Search ──────────────────────────────────────────────────── */
  searchResults(): MapElem[] {
    if (!this.searchQuery || this.searchQuery.length < 2) return [];
    const q = this.searchQuery.toLowerCase();
    return ALL_ELEMS.filter(e =>
      e.label.toLowerCase().includes(q) || (e.commune ?? '').toLowerCase().includes(q) || e.dept.toLowerCase().includes(q)
    ).slice(0, 8);
  }

  selectSearchResult(e: MapElem): void {
    this.showSearchDrop = false;
    this.searchQuery = '';
    this.selectElem(e.id);
  }

  onSearchChange(): void { this.showSearchDrop = true; this.rebuildMarkers(); }

  onSearchBlur(): void {
    this.searchBlurTimer = setTimeout(() => { this.showSearchDrop = false; }, 150);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.showSearchDrop = false;
    this.rebuildMarkers();
  }

  /* ── Helpers ─────────────────────────────────────────────────── */
  detailRoute(e: MapElem): string[] {
    if (e.type === 'alert_crit' || e.type === 'alert_warn') return ['/alertes'];
    if (e.type === 'intervention') return ['/gouvernance/interventions'];
    if (e.type === 'institution') return ['/gouvernance/institutions'];
    if (e.type === 'river' || e.type === 'spring' || e.type === 'lake') return ['/gouvernance/ressources'];
    return ['/gouvernance/infrastructures'];
  }

  elemColor(type: ElemType | string): string {
    const m: Record<string, string> = {
      reservoir:'#1d4ed8', captage:'#0d9488', pompe:'#7c3aed', traitement:'#6d28d9',
      sensor_on:'#22c55e', sensor_off:'#94a3b8',
      waterpoint:'#0ea5e9', fontaine:'#38bdf8',
      river:'#2563eb', spring:'#0d9488', lake:'#1d4ed8',
      zone_ok:'#10B981', zone_warn:'#f97316', zone_cut:'#EF4444',
      alert_crit:'#EF4444', alert_warn:'#F59E0B',
      intervention:'#3B82F6', institution:'#1e3a5f',
    };
    return m[type] ?? '#64748b';
  }

  elemSize(type: ElemType): number {
    if (type === 'alert_crit' || type === 'zone_cut') return 22;
    if (type === 'alert_warn' || type === 'zone_warn' || type === 'intervention') return 18;
    if (type === 'reservoir') return 16;
    return 13;
  }

  typeLabel(type: ElemType | string): string {
    const m: Record<string, string> = {
      reservoir:'Réservoir', captage:'Captage', pompe:'Station de pompage', traitement:'Station de traitement',
      sensor_on:'Capteur IoT', sensor_off:'Capteur hors ligne',
      waterpoint:"Point d'eau", fontaine:'Borne-fontaine',
      river:'Rivière', spring:'Source', lake:'Lac',
      zone_ok:'Zone normale', zone_warn:'Zone dégradée', zone_cut:'Coupure',
      alert_crit:'Alerte critique', alert_warn:'Alerte modérée',
      intervention:'Intervention', institution:'Institution',
    };
    return m[type] ?? String(type);
  }
}
