import { ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { BffApiService, CapteurDto, CreateInterventionPayload, UserProfileDto } from '../../../api/bff-api.service';
import { ScopeService } from '../../../scope.service';
import { InterventionStore } from '../../../intervention.store';
import { ToastService } from '../../../ui/toast.service';

interface TypeCard { key: string; label: string; icon: string; }
interface TacheLigne { libelle: string; obligatoire: boolean; on: boolean; }
interface PhotoLigne { key: string; label: string; on: boolean; }

const TYPES: TypeCard[] = [
  { key: 'journalier',  label: 'Journalier',          icon: 'ti-calendar' },
  { key: 'inspection',  label: 'Inspection ouvrage',  icon: 'ti-search' },
  { key: 'maintenance', label: 'Maintenance',         icon: 'ti-tool' },
  { key: 'iot',         label: 'Capteur IoT',         icon: 'ti-cpu' },
  { key: 'urgence',     label: 'Urgence / incident',  icon: 'ti-alert-triangle' },
  { key: 'reparation',  label: 'Réparation conduite', icon: 'ti-wrench' },
  { key: 'qualite',     label: 'Contrôle qualité',    icon: 'ti-droplet' },
  { key: 'nettoyage',   label: 'Nettoyage',           icon: 'ti-spray' },
  { key: 'recensement', label: 'Recensement',         icon: 'ti-clipboard-list' },
  { key: 'autre',       label: 'Autre',               icon: 'ti-dots' },
];

const TEMPLATES: Record<string, { libelle: string; obligatoire: boolean }[]> = {
  iot: [
    { libelle: "Vérifier l'alimentation du boîtier ESP32", obligatoire: true },
    { libelle: 'Contrôler la batterie du capteur', obligatoire: true },
    { libelle: 'Vérifier la connexion réseau', obligatoire: true },
    { libelle: 'Comparer la mesure terrain avec GEStiDLO', obligatoire: false },
    { libelle: 'Nettoyer le boîtier · vérifier câble/connecteur', obligatoire: false },
    { libelle: "Redémarrer l'ESP32 si nécessaire", obligatoire: false },
    { libelle: 'Prendre photo du capteur · signaler anomalie', obligatoire: true },
  ],
  inspection: [
    { libelle: 'Vérifier le niveau du réservoir', obligatoire: true },
    { libelle: "Vérifier l'état physique de l'ouvrage", obligatoire: true },
    { libelle: 'Contrôler les fuites visibles', obligatoire: true },
    { libelle: 'Vérifier les vannes', obligatoire: false },
    { libelle: 'Contrôler la pression au point de sortie', obligatoire: false },
    { libelle: 'Noter les anomalies observées', obligatoire: false },
  ],
  journalier: [
    { libelle: 'Visiter les ouvrages assignés', obligatoire: true },
    { libelle: 'Vérifier présence de fuite', obligatoire: true },
    { libelle: 'Relever les niveaux', obligatoire: true },
    { libelle: 'Vérifier état des bornes fontaines', obligatoire: false },
    { libelle: 'Noter plaintes des usagers', obligatoire: false },
  ],
  maintenance: [
    { libelle: "Diagnostiquer l'élément défaillant", obligatoire: true },
    { libelle: 'Remplacer / réparer la pièce', obligatoire: true },
    { libelle: 'Tester le fonctionnement après intervention', obligatoire: true },
    { libelle: 'Noter les pièces utilisées', obligatoire: false },
  ],
  reparation: [
    { libelle: 'Localiser la fuite / casse', obligatoire: true },
    { libelle: 'Couper la conduite si nécessaire', obligatoire: true },
    { libelle: 'Réparer / remplacer le tronçon', obligatoire: true },
    { libelle: 'Remettre en eau et vérifier la pression', obligatoire: true },
  ],
  urgence: [
    { libelle: 'Sécuriser la zone', obligatoire: true },
    { libelle: 'Évaluer la gravité', obligatoire: true },
    { libelle: 'Intervention de première urgence', obligatoire: true },
    { libelle: 'Rendre compte immédiatement au superviseur', obligatoire: true },
  ],
};
const TEMPLATE_GENERIQUE = [
  { libelle: 'Constater la situation sur place', obligatoire: true },
  { libelle: 'Réaliser le travail demandé', obligatoire: true },
  { libelle: 'Documenter (photo + observation)', obligatoire: true },
];

const PHOTOS_DEFAUT: PhotoLigne[] = [
  { key: 'avant',    label: 'Photo avant intervention',  on: true },
  { key: 'ouvrage',  label: "Photo de l'ouvrage",        on: true },
  { key: 'probleme', label: 'Photo du problème constaté', on: true },
  { key: 'apres',    label: 'Photo après intervention',  on: true },
];

/**
 * Assistant superviseur « Créer une intervention » — ordre de travail en 8 étapes.
 * Écrit contre le CONTRAT de l'InterventionStore (`creer` puis `envoyer`) ; le mock est encore
 * derrière, donc ce wizard ne sera pas jeté au swap mock→API (les signatures sont gelées).
 * Données scopées : communes (JWT), ouvrages/capteurs dérivés de /api/iot/capteurs, techniciens
 * de l'URD. Le rail de gauche EST l'accumulateur de la fiche = le futur payload.
 */
@Component({
  selector: 'app-creer-intervention-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="ci-overlay" (click)="fermer.emit()">
 <div class="ci-modal" (click)="$event.stopPropagation()">

  <div class="ci-head">
    <div>
      <p class="ci-title">Créer une intervention</p>
      <p class="ci-sub">Assistant guidé · ordre de travail terrain</p>
    </div>
    <button class="ci-x" (click)="fermer.emit()"><i class="ti ti-x"></i></button>
  </div>

  <!-- Stepper -->
  <div class="ci-stepper">
    <div class="ci-step" *ngFor="let s of stepsDef; let i = index" [class.ci-step--on]="step()===i+1" [class.ci-step--done]="step()>i+1" (click)="goto(i+1)">
      <span class="ci-step__n"><i *ngIf="step()>i+1" class="ti ti-check"></i><ng-container *ngIf="step()<=i+1">{{ i+1 }}</ng-container></span>
      <span class="ci-step__l">{{ s }}</span>
    </div>
  </div>

  <div class="ci-body">
    <!-- Rail récapitulatif (accumulateur = payload) -->
    <aside class="ci-rail">
      <p class="ci-rail__h">Récapitulatif</p>
      <div class="ci-chips" *ngIf="f().type">
        <span class="ci-chip ci-chip--accent">{{ typeLabel(f().type) }}</span>
        <span class="ci-chip" [ngClass]="'ci-chip--'+f().priorite" *ngIf="f().priorite">Priorité {{ f().priorite }}</span>
      </div>
      <div class="ci-rl" *ngIf="f().titre"><span>Titre</span><b>{{ f().titre }}</b></div>
      <div class="ci-rl"><span>Code</span><b>{{ code }} · auto</b></div>
      <hr class="ci-hr" *ngIf="f().commune || f().ouvrageId"/>
      <div class="ci-rl" *ngIf="f().commune"><span>Commune</span><b>{{ f().commune }}</b></div>
      <div class="ci-rl" *ngIf="ouvrageSel() as o"><span>Ouvrage</span><b>{{ o.nom }}</b><small>{{ o.id }}</small></div>
      <div class="ci-rl ci-warn" *ngIf="ouvrageSel() as o"><i class="ti ti-wifi-off" *ngIf="o.horsLigne>0"></i><span *ngIf="o.horsLigne>0">{{ o.horsLigne }} capteur(s) hors ligne</span></div>
      <hr class="ci-hr" *ngIf="f().principal"/>
      <div class="ci-rl" *ngIf="f().principal"><span>Technicien</span><b>{{ nomTech(f().principal) }}</b></div>
      <div class="ci-rl" *ngIf="f().appui.length"><span>Appui</span><b>{{ appuiNoms() }}</b></div>
      <div class="ci-rl" *ngIf="f().datePrevue"><span>Prévue</span><b>{{ f().datePrevue }} {{ f().heurePrevue }}</b></div>
      <div class="ci-rl" *ngIf="nbTaches()"><span>Tâches</span><b>{{ nbTaches() }} cochée(s)</b></div>
    </aside>

    <!-- Panneau étape -->
    <section class="ci-panel">

      <!-- 1 · Type -->
      <ng-container *ngIf="step()===1">
        <p class="ci-ph">Étape 1 · Type d'intervention</p>
        <div class="ci-types">
          <button class="ci-type" *ngFor="let t of typesDef" [class.ci-type--on]="f().type===t.key" (click)="choisirType(t.key)">
            <i class="ti {{t.icon}}"></i><span>{{ t.label }}</span>
          </button>
        </div>
      </ng-container>

      <!-- 2 · Identification -->
      <ng-container *ngIf="step()===2">
        <p class="ci-ph">Étape 2 · Identification</p>
        <label class="ci-f"><span>Titre *</span><input [ngModel]="f().titre" (ngModelChange)="patch({titre:$event})" placeholder="Ex : Diagnostic capteurs hors ligne — Réservoir Delmas 33"/></label>
        <div class="ci-g2">
          <label class="ci-f"><span>Commune *</span>
            <select [ngModel]="f().commune" (ngModelChange)="patch({commune:$event})">
              <option value="">—</option><option *ngFor="let c of communes()" [value]="c">{{ c }}</option>
            </select>
          </label>
          <label class="ci-f"><span>Localité / repère</span><input [ngModel]="f().localite" (ngModelChange)="patch({localite:$event})" placeholder="Ex : Delmas 33"/></label>
        </div>
        <div class="ci-g3">
          <label class="ci-f"><span>Date prévue</span><input type="date" [ngModel]="f().datePrevue" (ngModelChange)="patch({datePrevue:$event})"/></label>
          <label class="ci-f"><span>Heure</span><input type="time" [ngModel]="f().heurePrevue" (ngModelChange)="patch({heurePrevue:$event})"/></label>
          <label class="ci-f"><span>Durée (min)</span><input type="number" [ngModel]="f().dureeMinutes" (ngModelChange)="patch({dureeMinutes:$event})" placeholder="90"/></label>
        </div>
        <label class="ci-f"><span>Priorité</span>
          <div class="ci-prio">
            <button *ngFor="let p of ['basse','normale','haute','urgente']" class="ci-pr" [ngClass]="'ci-pr--'+p" [class.ci-pr--on]="f().priorite===p" (click)="patch({priorite:p})">{{ p }}</button>
          </div>
        </label>
      </ng-container>

      <!-- 3 · Ouvrage / capteurs -->
      <ng-container *ngIf="step()===3">
        <p class="ci-ph">Étape 3 · Ouvrage concerné <small>capteurs auto-remplis</small></p>
        <div class="ci-empty" *ngIf="ouvragesFiltres().length===0">Aucun ouvrage avec capteurs sur ce périmètre. (Étape facultative — passez à la suite.)</div>
        <div class="ci-ouv" *ngFor="let o of ouvragesFiltres()" [class.ci-ouv--on]="f().ouvrageId===o.id" (click)="choisirOuvrage(o.id)">
          <div class="ci-ouv__b"><b>{{ o.nom }}</b><small>{{ o.id }} · {{ o.commune }}</small></div>
          <span class="ci-ouv__n">{{ o.nbCapteurs }} capteur(s)<span class="ci-ouv__off" *ngIf="o.horsLigne>0"> · {{ o.horsLigne }} hors ligne</span></span>
        </div>
        <div class="ci-caps" *ngIf="capteursDeLOuvrage().length">
          <p class="ci-caps__h">Capteurs liés (auto)</p>
          <div class="ci-cap" *ngFor="let c of capteursDeLOuvrage()">
            <span>{{ c.nom }}</span><span class="ci-cap__v">{{ c.mesure }}</span>
            <span class="ci-cap__e" [ngClass]="'ci-cap__e--'+c.etat">{{ c.etat }}</span>
          </div>
        </div>
      </ng-container>

      <!-- 4 · Technicien -->
      <ng-container *ngIf="step()===4">
        <p class="ci-ph">Étape 4 · Technicien</p>
        <div class="ci-empty" *ngIf="techniciens().length===0">Aucun technicien dans votre URD.</div>
        <p class="ci-lbl" *ngIf="techniciens().length">Principal *</p>
        <div class="ci-tech" *ngFor="let t of techniciens()" [class.ci-tech--on]="f().principal===t.username" (click)="choisirPrincipal(t.username)">
          <span class="ci-av">{{ t.initiales || ini(t.nom) }}</span>
          <div class="ci-tech__b"><b>{{ t.nom }}</b><small>{{ t.email || t.fonction || t.role }}</small></div>
          <button class="ci-appui" [class.ci-appui--on]="f().appui.includes(t.username)" (click)="$event.stopPropagation(); toggleAppui(t.username)" [disabled]="f().principal===t.username">+ appui</button>
        </div>
      </ng-container>

      <!-- 5 · Travaux -->
      <ng-container *ngIf="step()===5">
        <p class="ci-ph">Étape 5 · Travaux à effectuer <small>pré-rempli selon le type — coche / retire / ajoute</small></p>
        <div class="ci-tk" *ngFor="let t of taches(); let i = index">
          <span class="ci-ck" [class.ci-ck--on]="t.on" (click)="toggleTache(i)"><i *ngIf="t.on" class="ti ti-check"></i></span>
          <span class="ci-tk__l" [class.ci-tk__l--off]="!t.on">{{ t.libelle }}</span>
          <span class="ci-oblig" *ngIf="t.obligatoire">obligatoire</span>
          <button class="ci-del" (click)="retirerTache(i)"><i class="ti ti-trash"></i></button>
        </div>
        <div class="ci-add"><input [(ngModel)]="nouvelleTache" placeholder="Ajouter une tâche…" (keyup.enter)="ajouterTache()"/><button (click)="ajouterTache()"><i class="ti ti-plus"></i></button></div>
      </ng-container>

      <!-- 6 · Consignes -->
      <ng-container *ngIf="step()===6">
        <p class="ci-ph">Étape 6 · Consignes & sécurité</p>
        <label class="ci-f"><span>Consignes du superviseur</span><textarea rows="3" [ngModel]="f().consignes" (ngModelChange)="patch({consignes:$event})" placeholder="Ex : vérifier pourquoi les capteurs sont hors ligne depuis plusieurs minutes."></textarea></label>
        <label class="ci-f"><span>Résultat attendu</span><textarea rows="2" [ngModel]="f().resultatAttendu" (ngModelChange)="patch({resultatAttendu:$event})" placeholder="Les capteurs repassent en ligne ou une anomalie est documentée."></textarea></label>
        <div class="ci-g2">
          <label class="ci-f"><span>Matériel recommandé</span><input [ngModel]="f().materiel" (ngModelChange)="patch({materiel:$event})" placeholder="Téléphone, gants, multimètre…"/></label>
          <label class="ci-f"><span>Risques / sécurité</span><input [ngModel]="f().risques" (ngModelChange)="patch({risques:$event})" placeholder="Ne pas ouvrir le coffret sans autorisation"/></label>
        </div>
      </ng-container>

      <!-- 7 · Pièces attendues -->
      <ng-container *ngIf="step()===7">
        <p class="ci-ph">Étape 7 · Photos / pièces attendues <small>deviennent des tâches obligatoires</small></p>
        <div class="ci-tk" *ngFor="let p of photos(); let i = index">
          <span class="ci-ck" [class.ci-ck--on]="p.on" (click)="togglePhoto(i)"><i *ngIf="p.on" class="ti ti-check"></i></span>
          <span class="ci-tk__l" [class.ci-tk__l--off]="!p.on"><i class="ti ti-camera"></i> {{ p.label }}</span>
        </div>
      </ng-container>

      <!-- 8 · Aperçu -->
      <ng-container *ngIf="step()===8">
        <p class="ci-ph">Étape 8 · Aperçu & envoi</p>
        <div class="ci-ap">
          <div class="ci-ap__t">FICHE D'INTERVENTION · {{ code }}</div>
          <div class="ci-rl"><span>Type</span><b>{{ typeLabel(f().type) }} · priorité {{ f().priorite }}</b></div>
          <div class="ci-rl"><span>Titre</span><b>{{ f().titre || '—' }}</b></div>
          <div class="ci-rl"><span>Commune</span><b>{{ f().commune || '—' }}</b></div>
          <div class="ci-rl" *ngIf="ouvrageSel() as o"><span>Ouvrage</span><b>{{ o.nom }}</b></div>
          <div class="ci-rl"><span>Technicien</span><b>{{ nomTech(f().principal) || '—' }}<span *ngIf="f().appui.length"> · appui {{ appuiNoms() }}</span></b></div>
          <div class="ci-rl"><span>Prévue</span><b>{{ f().datePrevue || '—' }} {{ f().heurePrevue }}</b></div>
          <div class="ci-ap__sec">Travaux demandés ({{ nbTaches() }})</div>
          <div class="ci-ap__task" *ngFor="let t of tachesFinales()"><i class="ti ti-point"></i>{{ t.libelle }}</div>
          <div class="ci-ap__sec" *ngIf="f().consignes">Consignes</div>
          <p class="ci-ap__cons" *ngIf="f().consignes">{{ f().consignes }}</p>
        </div>
      </ng-container>
    </section>
  </div>

  <div class="ci-foot">
    <span class="ci-foot__s">Étape {{ step() }} sur 8</span>
    <div class="ci-foot__a">
      <button class="ci-btn" *ngIf="step()>1" (click)="prev()"><i class="ti ti-arrow-left"></i> Précédent</button>
      <button class="ci-btn ci-btn--p" *ngIf="step()<8" [disabled]="!canNext()" (click)="next()">Suivant <i class="ti ti-arrow-right"></i></button>
      <button class="ci-btn ci-btn--p" *ngIf="step()===8" [disabled]="saving() || !canSubmit()" (click)="submit()"><i class="ti ti-send"></i> {{ saving() ? 'Envoi…' : 'Envoyer au technicien' }}</button>
    </div>
  </div>

 </div>
</div>
  `,
  styles: [`
    .ci-overlay { position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:1200; display:flex; align-items:center; justify-content:center; padding:18px; }
    .ci-modal { width:920px; max-width:97vw; max-height:94vh; overflow:hidden; display:flex; flex-direction:column; background:#0F1419; border:1px solid #1F2A33; border-radius:16px; color:#E2E8EE; font-family:-apple-system,system-ui,sans-serif; }
    .ci-head { display:flex; justify-content:space-between; align-items:flex-start; padding:16px 18px; }
    .ci-title { font-size:17px; font-weight:500; margin:0; } .ci-sub { font-size:12.5px; color:#8B9AAB; margin:3px 0 0; }
    .ci-x { width:32px; height:32px; border-radius:8px; border:1px solid #2A3744; background:#1A222C; color:#CBD5E1; cursor:pointer; }
    .ci-stepper { display:flex; justify-content:space-between; padding:6px 18px 14px; gap:4px; }
    .ci-step { display:flex; flex-direction:column; align-items:center; gap:5px; flex:1; cursor:pointer; }
    .ci-step__n { width:27px; height:27px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; background:#161D26; border:1px solid #2A3744; color:#6B7785; }
    .ci-step--on .ci-step__n { border-color:#60A5FA; color:#93C5FD; background:rgba(96,165,250,.12); }
    .ci-step--done .ci-step__n { background:rgba(96,165,250,.18); border-color:#60A5FA; color:#93C5FD; }
    .ci-step__l { font-size:9.5px; color:#6B7785; text-align:center; } .ci-step--on .ci-step__l { color:#E2E8EE; font-weight:500; }
    .ci-body { display:grid; grid-template-columns:230px 1fr; gap:14px; padding:4px 18px 8px; overflow-y:auto; }
    .ci-rail { background:#10161D; border:1px solid #1F2A33; border-radius:12px; padding:13px; align-self:start; }
    .ci-rail__h { font-size:11px; color:#6B7785; margin:0 0 10px; }
    .ci-chips { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px; }
    .ci-chip { font-size:11px; padding:3px 9px; border-radius:6px; background:rgba(255,255,255,.05); color:#CBD5E1; }
    .ci-chip--accent { background:rgba(96,165,250,.14); color:#93C5FD; }
    .ci-chip--haute,.ci-chip--urgente { background:rgba(251,191,36,.14); color:#FBBF24; }
    .ci-rl { margin-bottom:9px; font-size:12.5px; display:flex; flex-direction:column; }
    .ci-rl span { font-size:10.5px; color:#6B7785; } .ci-rl b { color:#E2E8EE; font-weight:500; margin-top:1px; } .ci-rl small { font-size:10px; color:#6B7785; }
    .ci-warn { color:#FBBF24; flex-direction:row; gap:5px; align-items:center; font-size:11.5px; }
    .ci-hr { border:0; border-top:1px solid #1F2A33; margin:11px 0; }
    .ci-panel { min-width:0; padding-bottom:6px; }
    .ci-ph { font-size:14px; font-weight:500; margin:2px 0 12px; } .ci-ph small { font-size:11.5px; color:#8B9AAB; font-weight:400; margin-left:4px; }
    .ci-types { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
    .ci-type { display:flex; align-items:center; gap:9px; padding:11px 12px; border-radius:10px; border:1px solid #2A3744; background:#161D26; color:#CBD5E1; cursor:pointer; font-size:13px; }
    .ci-type i { font-size:18px; color:#8B9AAB; } .ci-type--on { border-color:#60A5FA; background:rgba(96,165,250,.1); color:#93C5FD; } .ci-type--on i { color:#60A5FA; }
    .ci-f { display:flex; flex-direction:column; gap:5px; margin-bottom:12px; } .ci-f>span { font-size:12px; color:#8B9AAB; }
    .ci-f input,.ci-f select,.ci-f textarea { background:#10161D; border:1px solid #2A3744; border-radius:8px; padding:9px 11px; color:#E2E8EE; font-size:13px; outline:none; font-family:inherit; }
    .ci-f input:focus,.ci-f select:focus,.ci-f textarea:focus { border-color:#60A5FA; }
    .ci-g2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; } .ci-g3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
    .ci-prio { display:flex; gap:6px; } .ci-pr { flex:1; padding:8px; border-radius:8px; border:1px solid #2A3744; background:#161D26; color:#8B9AAB; cursor:pointer; font-size:12px; text-transform:capitalize; }
    .ci-pr--on { border-color:#60A5FA; color:#93C5FD; background:rgba(96,165,250,.12); } .ci-pr--haute.ci-pr--on,.ci-pr--urgente.ci-pr--on { border-color:#FBBF24; color:#FBBF24; background:rgba(251,191,36,.12); }
    .ci-ouv { display:flex; justify-content:space-between; align-items:center; padding:11px 12px; border:1px solid #2A3744; border-radius:10px; margin-bottom:8px; cursor:pointer; background:#161D26; }
    .ci-ouv--on { border-color:#60A5FA; background:rgba(96,165,250,.08); } .ci-ouv__b b { font-size:13px; } .ci-ouv__b small { display:block; font-size:11px; color:#6B7785; }
    .ci-ouv__n { font-size:11.5px; color:#8B9AAB; } .ci-ouv__off { color:#FBBF24; }
    .ci-caps { margin-top:10px; background:#10161D; border:1px solid #1F2A33; border-radius:10px; padding:10px; } .ci-caps__h { font-size:11px; color:#6B7785; margin:0 0 7px; }
    .ci-cap { display:flex; align-items:center; gap:8px; padding:4px 0; font-size:12.5px; } .ci-cap span:first-child { flex:1; } .ci-cap__v { color:#8B9AAB; }
    .ci-cap__e { font-size:10px; padding:1px 7px; border-radius:5px; } .ci-cap__e--ok { background:rgba(52,211,153,.14); color:#34D399; } .ci-cap__e--seuil { background:rgba(248,113,113,.14); color:#F87171; } .ci-cap__e--hors-ligne { background:rgba(255,255,255,.06); color:#8B9AAB; }
    .ci-lbl { font-size:11px; color:#8B9AAB; margin:0 0 7px; }
    .ci-tech { display:flex; align-items:center; gap:10px; padding:9px 11px; border:1px solid #2A3744; border-radius:10px; margin-bottom:7px; cursor:pointer; background:#161D26; }
    .ci-tech--on { border-color:#60A5FA; background:rgba(96,165,250,.08); } .ci-av { width:30px; height:30px; border-radius:50%; background:rgba(96,165,250,.15); color:#93C5FD; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; }
    .ci-tech__b { flex:1; } .ci-tech__b b { font-size:13px; } .ci-tech__b small { display:block; font-size:11px; color:#6B7785; }
    .ci-appui { font-size:11px; padding:4px 9px; border-radius:7px; border:1px solid #2A3744; background:transparent; color:#8B9AAB; cursor:pointer; } .ci-appui--on { border-color:#34D399; color:#34D399; } .ci-appui:disabled { opacity:.35; cursor:not-allowed; }
    .ci-tk { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid #1F2A33; }
    .ci-ck { width:19px; height:19px; border-radius:5px; border:1px solid #3A4754; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; } .ci-ck--on { background:rgba(96,165,250,.15); border-color:#60A5FA; color:#60A5FA; }
    .ci-tk__l { flex:1; font-size:13px; } .ci-tk__l--off { color:#6B7785; text-decoration:line-through; }
    .ci-oblig { font-size:10px; color:#8B9AAB; background:#161D26; border:1px solid #2A3744; padding:1px 6px; border-radius:5px; }
    .ci-del { background:transparent; border:0; color:#6B7785; cursor:pointer; } .ci-del:hover { color:#F87171; }
    .ci-add { display:flex; gap:8px; margin-top:12px; } .ci-add input { flex:1; background:#10161D; border:1px solid #2A3744; border-radius:8px; padding:9px 11px; color:#E2E8EE; font-size:13px; outline:none; } .ci-add button { width:40px; border-radius:8px; border:1px solid #2A3744; background:#161D26; color:#93C5FD; cursor:pointer; }
    .ci-ap { background:#10161D; border:1px solid #1F2A33; border-radius:12px; padding:14px; } .ci-ap__t { font-size:12px; letter-spacing:.5px; color:#8B9AAB; margin-bottom:12px; }
    .ci-ap__sec { font-size:11px; color:#6B7785; margin:12px 0 6px; text-transform:uppercase; letter-spacing:.4px; }
    .ci-ap__task { font-size:12.5px; padding:2px 0; color:#CBD5E1; } .ci-ap__task i { font-size:12px; color:#60A5FA; margin-right:4px; } .ci-ap__cons { font-size:12.5px; color:#CBD5E1; margin:0; }
    .ci-empty { font-size:12.5px; color:#6B7785; padding:14px; text-align:center; background:#10161D; border:1px dashed #2A3744; border-radius:10px; }
    .ci-foot { display:flex; justify-content:space-between; align-items:center; padding:13px 18px; border-top:1px solid #1F2A33; }
    .ci-foot__s { font-size:12px; color:#6B7785; } .ci-foot__a { display:flex; gap:8px; }
    .ci-btn { display:flex; align-items:center; gap:6px; font-size:13.5px; padding:9px 15px; border-radius:9px; border:1px solid #2A3744; background:#161D26; color:#CBD5E1; cursor:pointer; }
    .ci-btn--p { background:#2563EB; border-color:#2563EB; color:#fff; } .ci-btn--p:disabled { opacity:.45; cursor:not-allowed; }
  `],
})
export class CreerInterventionWizardComponent implements OnInit {
  @Output() fermer = new EventEmitter<void>();
  @Output() cree   = new EventEmitter<void>();

  private readonly bff   = inject(BffApiService);
  private readonly scopeSvc = inject(ScopeService);
  private readonly store = inject(InterventionStore);
  private readonly toast = inject(ToastService);

  readonly typesDef = TYPES;
  readonly stepsDef = ['Type', 'Infos', 'Ouvrage', 'Équipe', 'Travaux', 'Consignes', 'Pièces', 'Aperçu'];

  readonly step   = signal(1);
  readonly saving = signal(false);
  readonly communes    = signal<string[]>([]);
  readonly capteurs    = signal<CapteurDto[]>([]);
  readonly techniciens = signal<UserProfileDto[]>([]);

  readonly f = signal({
    type: '', priorite: 'normale', titre: '', commune: '', localite: '',
    datePrevue: '', heurePrevue: '', dureeMinutes: null as number | null,
    ouvrageId: '', capteurId: '', principal: '', appui: [] as string[],
    consignes: '', resultatAttendu: '', materiel: '', risques: '',
  });
  readonly taches = signal<TacheLigne[]>([]);
  readonly photos = signal<PhotoLigne[]>(PHOTOS_DEFAUT.map(p => ({ ...p })));
  nouvelleTache = '';
  readonly code = 'INT-' + new Date().getFullYear() + '-' + Math.floor(1000 + (new Date().getMinutes() * 60 + new Date().getSeconds()));

  private get scope() { return this.scopeSvc.autoScope ?? undefined; }

  ngOnInit(): void {
    const dept = this.scope?.dept;
    this.bff.communes(dept).pipe(catchError(() => of([] as any[]))).subscribe(l => this.communes.set(l.map(c => c.nom)));
    this.bff.listCapteurs().pipe(catchError(() => of([] as CapteurDto[]))).subscribe(l => this.capteurs.set(l ?? []));
    this.bff.listUsers(this.scope?.urdId).pipe(catchError(() => of([] as UserProfileDto[]))).subscribe(l =>
      this.techniciens.set((l ?? []).filter(u => /tepac|technic/i.test(u.role))));
  }

  // ── Dérivés ──
  readonly ouvrages = computed(() => {
    const m = new Map<string, { id: string; nom: string; commune: string | null; nbCapteurs: number; horsLigne: number }>();
    for (const c of this.capteurs()) {
      if (!c.ouvrageId) continue;
      const e = m.get(c.ouvrageId) ?? { id: c.ouvrageId, nom: c.ouvrageNom || c.ouvrageId, commune: c.commune, nbCapteurs: 0, horsLigne: 0 };
      e.nbCapteurs++; if (c.etat === 'hors-ligne') e.horsLigne++;
      m.set(c.ouvrageId, e);
    }
    return [...m.values()];
  });
  readonly ouvragesFiltres = computed(() => {
    const com = this.f().commune;
    return this.ouvrages().filter(o => !com || (o.commune ?? '').toLowerCase() === com.toLowerCase());
  });
  readonly ouvrageSel = computed(() => this.ouvrages().find(o => o.id === this.f().ouvrageId) ?? null);
  readonly capteursDeLOuvrage = computed(() => this.capteurs().filter(c => c.ouvrageId === this.f().ouvrageId));
  readonly nbTaches = computed(() => this.taches().filter(t => t.on).length + this.photos().filter(p => p.on).length);
  readonly tachesFinales = computed(() => [
    ...this.taches().filter(t => t.on).map(t => ({ libelle: t.libelle, obligatoire: t.obligatoire })),
    ...this.photos().filter(p => p.on).map(p => ({ libelle: 'Photo : ' + p.label, obligatoire: true })),
  ]);

  // ── Mutations ──
  patch(p: Partial<ReturnType<typeof this.f>>): void { this.f.update(v => ({ ...v, ...p })); }
  choisirType(k: string): void { this.patch({ type: k }); this.taches.set((TEMPLATES[k] ?? TEMPLATE_GENERIQUE).map(t => ({ ...t, on: true }))); }
  choisirOuvrage(id: string): void {
    const o = this.ouvrages().find(x => x.id === id);
    this.patch({ ouvrageId: this.f().ouvrageId === id ? '' : id, commune: this.f().commune || (o?.commune ?? '') });
  }
  choisirPrincipal(u: string): void { this.patch({ principal: u, appui: this.f().appui.filter(a => a !== u) }); }
  toggleAppui(u: string): void { this.patch({ appui: this.f().appui.includes(u) ? this.f().appui.filter(a => a !== u) : [...this.f().appui, u] }); }
  toggleTache(i: number): void { this.taches.update(l => l.map((t, j) => j === i ? { ...t, on: !t.on } : t)); }
  retirerTache(i: number): void { this.taches.update(l => l.filter((_, j) => j !== i)); }
  ajouterTache(): void { const v = this.nouvelleTache.trim(); if (!v) return; this.taches.update(l => [...l, { libelle: v, obligatoire: false, on: true }]); this.nouvelleTache = ''; }
  togglePhoto(i: number): void { this.photos.update(l => l.map((p, j) => j === i ? { ...p, on: !p.on } : p)); }

  // ── Navigation ──
  goto(n: number): void { if (n < this.step()) this.step.set(n); }
  prev(): void { this.step.update(s => Math.max(1, s - 1)); }
  next(): void { if (this.canNext()) this.step.update(s => Math.min(8, s + 1)); }
  canNext(): boolean {
    switch (this.step()) {
      case 1: return !!this.f().type;
      case 2: return !!this.f().titre.trim() && !!this.f().commune;
      case 4: return !!this.f().principal;
      default: return true;
    }
  }
  canSubmit(): boolean { return !!this.f().type && !!this.f().titre.trim() && !!this.f().commune && !!this.f().principal; }

  // ── Affichage ──
  typeLabel(k: string): string { return TYPES.find(t => t.key === k)?.label ?? k; }
  nomTech(u: string): string { return this.techniciens().find(t => t.username === u)?.nom ?? u; }
  appuiNoms(): string { return this.f().appui.map(u => this.nomTech(u)).join(', '); }
  ini(nom: string): string { return (nom || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }

  // ── Envoi (contrat InterventionStore : creer → envoyer) ──
  submit(): void {
    if (!this.canSubmit()) return;
    const f = this.f();
    const datePrevue = f.datePrevue
      ? new Date(f.datePrevue + 'T' + (f.heurePrevue || '08:00') + ':00').toISOString()
      : null;
    const payload: CreateInterventionPayload = {
      type: f.type, priorite: f.priorite, titre: f.titre.trim(), commune: f.commune,
      ouvrageId: f.ouvrageId || null, capteurId: f.capteurId || null,
      datePrevue, heurePrevue: f.heurePrevue || null, dureeMinutes: f.dureeMinutes,
      consignes: f.consignes || null, resultatAttendu: f.resultatAttendu || null,
      materiel: f.materiel || null, risques: f.risques || null,
      assignee: f.principal || null,
      taches: this.tachesFinales(),
    };
    this.saving.set(true);
    this.store.creer(payload).subscribe({
      next: (it) => this.store.envoyer(it.id).subscribe({
        next: () => { this.toast.push('success', 'Intervention envoyée au technicien'); this.saving.set(false); this.cree.emit(); this.fermer.emit(); },
        error: () => { this.saving.set(false); this.toast.push('error', "Échec de l'envoi"); },
      }),
      error: () => { this.saving.set(false); this.toast.push('error', 'Échec de la création'); },
    });
  }
}
