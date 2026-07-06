import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../auth.service';
import { BffApiService } from '../../api/bff-api.service';
import { RapportsStore } from '../../rapports.store';

/** Un élément sélectionnable dans le contexte (ouvrage / capteur / ressource de la commune). */
interface ElementContexte { id: string; nom: string; sous: string; }
/** Une photo terrain catégorisée (preuve avant/pendant/après) avec sa légende. */
interface PhotoItem { url: string; name: string; categorie: string; legende: string; }

/** Étapes du wizard, gatées par type : l'intervention suit le modèle pro complet (7 piliers),
 *  les autres types un sous-ensemble cohérent avec leur nature. */
const STEP_LABELS: Record<string, string> = {
  type: 'Type', identification: 'Identification', temporel: 'Contexte',
  diagnostic: 'Diagnostic', operations: 'Opérations', materiaux: 'Matériaux',
  photos: 'Photos', observations: 'Observations', validation: 'Validation', apercu: 'Aperçu',
};
const STEPS_BY_TYPE: Record<string, string[]> = {
  // Modèle professionnel complet (les 7 piliers + photos + validation).
  intervention:   ['type', 'identification', 'temporel', 'diagnostic', 'operations', 'materiaux', 'photos', 'observations', 'validation', 'apercu'],
  incident:       ['type', 'identification', 'temporel', 'diagnostic', 'photos', 'observations', 'validation', 'apercu'],
  infrastructure: ['type', 'identification', 'diagnostic', 'photos', 'observations', 'apercu'],
  ressource:      ['type', 'identification', 'photos', 'observations', 'apercu'],
  iot:            ['type', 'identification', 'diagnostic', 'photos', 'apercu'],
  journalier:     ['type', 'identification', 'diagnostic', 'photos', 'observations', 'apercu'],
};

/**
 * Assistant de soumission d'un rapport terrain (TEPAC). Le technicien CLIQUE, le serveur RÉDIGE :
 * il coche/sélectionne (presque aucune saisie libre), la zone est verrouillée sur son affectation
 * (jamais saisie), et l'aperçu professionnel est le texte réellement généré par le backend.
 *
 * Le parcours suit les 7 piliers d'un rapport d'intervention pro : Identification → Contexte
 * temporel → Diagnostic → Opérations → Matériaux → Photos → Observations → Validation → Aperçu.
 * Le nombre d'étapes s'adapte au type (cf. STEPS_BY_TYPE). À l'entrée sur Aperçu on crée le
 * BROUILLON (creer → resumeAuto serveur = auto-save) ; à Soumettre on transmet (→ TRANSMIS).
 */
@Component({
  selector: 'app-soumettre-rapport',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="wz-backdrop" (click)="fermer.emit()">
  <div class="wz" (click)="$event.stopPropagation()">

    <!-- En-tête -->
    <div class="wz-head">
      <div class="wz-head__l">
        <i class="ti ti-file-text wz-head__ic"></i>
        <div>
          <div class="wz-head__t">Soumettre un rapport</div>
          <div class="wz-head__s">Assistant guidé · rapport professionnel</div>
        </div>
      </div>
      <i class="ti ti-x wz-x" (click)="fermer.emit()"></i>
    </div>

    <!-- Bandeau zone verrouillée (source = affectation du token, jamais saisi) -->
    <div class="wz-lock">
      <i class="ti ti-lock"></i>
      <span><b>{{ commune || '—' }}<span *ngIf="urd"> · URD {{ urd }}</span><span *ngIf="technicien"> · {{ technicien }}</span></b> — automatique selon votre affectation</span>
    </div>

    <!-- Stepper -->
    <div class="wz-steps">
      <ng-container *ngFor="let s of steps(); let i = index">
        <div class="wz-step" [class.wz-step--done]="step() > i+1" [class.wz-step--on]="step() === i+1">
          <div class="wz-step__n"><i *ngIf="step() > i+1" class="ti ti-check"></i><span *ngIf="step() <= i+1">{{ i+1 }}</span></div>
          <span class="wz-step__l">{{ s.label }}</span>
        </div>
        <div *ngIf="i < steps().length-1" class="wz-step__sep"></div>
      </ng-container>
    </div>

    <!-- Corps -->
    <div class="wz-body">

      <!-- TYPE -->
      <div *ngIf="key()==='type'" class="wz-grid2">
        <button *ngFor="let t of TYPES" type="button" class="wz-card" [class.wz-card--on]="type()===t.id" (click)="choisirType(t.id)">
          <i class="ti {{ t.icon }}"></i><span>{{ t.label }}</span>
        </button>
      </div>

      <!-- IDENTIFICATION — liste scopée commune, pilotée par le type. Le technicien CHOISIT. -->
      <div *ngIf="key()==='identification'" class="wz-col">
        <div class="wz-recap">
          <div class="wz-recap__r"><span>Technicien</span><b>{{ technicien || '—' }}</b></div>
          <div class="wz-recap__r"><span>URD</span><b>{{ urd || '—' }}</b></div>
          <div class="wz-recap__r"><span>Commune</span><b>{{ commune || '—' }}</b></div>
        </div>
        <div class="wz-note"><i class="ti ti-map-pin"></i> {{ sourceLabelPluriel() }} de votre commune. Sélectionnez l'élément concerné.</div>

        <div *ngIf="loadingElems()" class="wz-note"><i class="ti ti-loader"></i> Chargement…</div>
        <div *ngIf="!loadingElems() && sourceFor(type())==='aucun'" class="wz-note">
          Rapport général de la commune — aucun élément spécifique requis.
        </div>
        <div *ngIf="!loadingElems() && elements().length===0 && gated(type())" class="wz-block">
          <i class="ti ti-lock"></i> {{ blocageMessage() }}
        </div>
        <div *ngIf="!loadingElems() && sourceFor(type())!=='aucun' && elements().length===0 && !gated(type())" class="wz-empty">
          <i class="ti ti-alert-circle"></i> Aucun {{ sourceLabel() }} recensé dans votre commune. Vous pouvez continuer sans sélection.
        </div>
        <div *ngIf="!loadingElems() && elements().length > 0" class="wz-elems">
          <button *ngFor="let e of elements()" type="button" class="wz-elem" [class.wz-elem--on]="selected()?.id===e.id" (click)="selected.set(e)">
            <span class="wz-box"><i *ngIf="selected()?.id===e.id" class="ti ti-check"></i></span>
            <span class="wz-elem__txt"><span class="wz-elem__n">{{ e.nom }}</span><span class="wz-elem__s">{{ e.sous }}</span></span>
          </button>
        </div>
      </div>

      <!-- CONTEXTE TEMPOREL (pilier 2) -->
      <div *ngIf="key()==='temporel'" class="wz-col">
        <label class="wz-lbl">Horaires de l'intervention</label>
        <div class="wz-row">
          <div class="wz-tcol"><span class="wz-tlbl">Arrivée</span><input type="time" class="wz-in" [(ngModel)]="heureArrivee"></div>
          <div class="wz-tcol"><span class="wz-tlbl">Début</span><input type="time" class="wz-in" [(ngModel)]="heureDebut"></div>
          <div class="wz-tcol"><span class="wz-tlbl">Fin</span><input type="time" class="wz-in" [(ngModel)]="heureFin"></div>
        </div>
        <div *ngIf="dureeCalc()" class="wz-note"><i class="ti ti-clock"></i> Durée calculée : <b>&nbsp;{{ dureeCalc() }}</b></div>

        <label class="wz-lbl">Contexte de la mission</label>
        <div class="wz-segs wz-segs--wrap">
          <button *ngFor="let m of CONTEXTES" type="button" class="wz-seg wz-seg--gen" [class.wz-seg--on]="contexteMission()===m" (click)="contexteMission.set(m)">{{ m }}</button>
        </div>

        <label class="wz-lbl">Conditions de terrain</label>
        <div class="wz-grid2">
          <button *ngFor="let c of CONDITIONS" type="button" class="wz-chk" [class.wz-chk--on]="conditions().has(c)" (click)="toggle(conditions, c)">
            <span class="wz-box"><i *ngIf="conditions().has(c)" class="ti ti-check"></i></span>{{ c }}
          </button>
        </div>
      </div>

      <!-- DIAGNOSTIC / CONSTAT (pilier 3) -->
      <div *ngIf="key()==='diagnostic'" class="wz-col">
        <label class="wz-lbl">État général du réseau</label>
        <div class="wz-segs">
          <button *ngFor="let e of ETATS" type="button" class="wz-seg" [class.wz-seg--on]="etat()===e" [attr.data-e]="e" (click)="etat.set(e)">{{ e }}</button>
        </div>

        <label class="wz-lbl">Problèmes observés</label>
        <div class="wz-grid2">
          <button *ngFor="let p of PROBLEMES" type="button" class="wz-chk wz-chk--danger" [class.wz-chk--on]="problemes().has(p)" (click)="toggle(problemes, p)">
            <span class="wz-box"><i *ngIf="problemes().has(p)" class="ti ti-check"></i></span>{{ p }}
          </button>
        </div>

        <div class="wz-row">
          <div class="wz-tcol wz-grow">
            <label class="wz-lbl">Impact estimé</label>
            <div class="wz-segs wz-segs--wrap">
              <button *ngFor="let im of IMPACTS" type="button" class="wz-seg wz-seg--gen" [class.wz-seg--on]="impact()===im" (click)="impact.set(im)">{{ im }}</button>
            </div>
          </div>
          <div class="wz-tcol">
            <label class="wz-lbl">Pop. impactée</label>
            <input type="number" min="0" class="wz-in" [(ngModel)]="population" placeholder="ménages">
          </div>
        </div>

        <label class="wz-lbl">Cause probable</label>
        <input type="text" class="wz-in" [(ngModel)]="cause" placeholder="Ex. accumulation de dépôts, mauvais réglage…">
      </div>

      <!-- OPÉRATIONS RÉALISÉES (pilier 4) -->
      <div *ngIf="key()==='operations'" class="wz-col">
        <label class="wz-lbl">Activités réalisées</label>
        <div class="wz-grid2">
          <button *ngFor="let a of ACTIVITES" type="button" class="wz-chk" [class.wz-chk--on]="activites().has(a)" (click)="toggle(activites, a)">
            <span class="wz-box"><i *ngIf="activites().has(a)" class="ti ti-check"></i></span>{{ a }}
          </button>
        </div>

        <label class="wz-lbl">Tests effectués</label>
        <div class="wz-grid2">
          <button *ngFor="let t of TESTS" type="button" class="wz-chk" [class.wz-chk--on]="tests().has(t)" (click)="toggle(tests, t)">
            <span class="wz-box"><i *ngIf="tests().has(t)" class="ti ti-check"></i></span>{{ t }}
          </button>
        </div>

        <label class="wz-lbl">Résultat final</label>
        <div class="wz-segs wz-segs--wrap">
          <button *ngFor="let r of RESULTATS" type="button" class="wz-seg wz-seg--gen" [class.wz-seg--on]="resultat()===r" (click)="resultat.set(r)">{{ r }}</button>
        </div>
      </div>

      <!-- MATÉRIAUX / RESSOURCES (pilier 5) -->
      <div *ngIf="key()==='materiaux'" class="wz-col">
        <button type="button" class="wz-chk wz-chk--wide" [class.wz-chk--on]="aucunMateriel()" (click)="toggleAucun()">
          <span class="wz-box"><i *ngIf="aucunMateriel()" class="ti ti-check"></i></span>Aucun matériel utilisé
        </button>

        <ng-container *ngIf="!aucunMateriel()">
          <label class="wz-lbl">Pièces remplacées</label>
          <div class="wz-grid2">
            <button *ngFor="let p of PIECES" type="button" class="wz-chk" [class.wz-chk--on]="pieces().has(p)" (click)="toggle(pieces, p)">
              <span class="wz-box"><i *ngIf="pieces().has(p)" class="ti ti-check"></i></span>{{ p }}
            </button>
          </div>

          <label class="wz-lbl">Consommables</label>
          <div class="wz-grid2">
            <button *ngFor="let c of CONSOMMABLES" type="button" class="wz-chk" [class.wz-chk--on]="consommables().has(c)" (click)="toggle(consommables, c)">
              <span class="wz-box"><i *ngIf="consommables().has(c)" class="ti ti-check"></i></span>{{ c }}
            </button>
          </div>

          <label class="wz-lbl">Outils mobilisés</label>
          <div class="wz-grid2">
            <button *ngFor="let o of OUTILS" type="button" class="wz-chk" [class.wz-chk--on]="outils().has(o)" (click)="toggle(outils, o)">
              <span class="wz-box"><i *ngIf="outils().has(o)" class="ti ti-check"></i></span>{{ o }}
            </button>
          </div>
        </ng-container>
      </div>

      <!-- PHOTOS & PREUVES (avant / pendant / après + légende) -->
      <div *ngIf="key()==='photos'" class="wz-col">
        <input #camInput type="file" accept="image/*" capture="environment" multiple hidden (change)="onPhotos($event)" />
        <input #fileInput type="file" accept="image/*" multiple hidden (change)="onPhotos($event)" />

        <div class="wz-photo-btns">
          <button type="button" class="wz-pbtn" (click)="camInput.click()"><i class="ti ti-camera"></i> Prendre une photo</button>
          <button type="button" class="wz-pbtn" (click)="fileInput.click()"><i class="ti ti-photo"></i> Choisir un fichier</button>
        </div>

        <div *ngIf="photos().length === 0" class="wz-drop" (click)="fileInput.click()">
          <i class="ti ti-camera"></i>
          <div class="wz-drop__t">Aucune photo — appuyez pour en ajouter</div>
          <div class="wz-drop__s">Catégorisez chaque cliché : avant / pendant / après. Facultatif.</div>
        </div>

        <div *ngIf="photos().length > 0" class="wz-plist">
          <div *ngFor="let p of photos(); let i = index" class="wz-prow">
            <img [src]="p.url" [alt]="p.name" />
            <div class="wz-pmeta">
              <select class="wz-cat" [(ngModel)]="p.categorie">
                <option *ngFor="let c of CATEGORIES" [value]="c">{{ c }}</option>
              </select>
              <input type="text" class="wz-cap" [(ngModel)]="p.legende" placeholder="Légende (ex. état initial de la vanne)">
            </div>
            <button type="button" class="wz-prow__x" (click)="removePhoto(i)"><i class="ti ti-x"></i></button>
          </div>
        </div>

        <div class="wz-note"><i class="ti ti-map-pin"></i> {{ photos().length }} photo(s) · GPS capturé à la prise (démo). L'upload serveur sera branché ultérieurement.</div>
      </div>

      <!-- OBSERVATIONS & RECOMMANDATIONS (pilier 6) -->
      <div *ngIf="key()==='observations'" class="wz-col">
        <label class="wz-lbl">Observation générale</label>
        <textarea class="wz-in" rows="2" [(ngModel)]="observation" placeholder="Ex. Circulation améliorée, mais pression encore basse aux heures de pointe."></textarea>

        <label class="wz-lbl">Recommandation</label>
        <textarea class="wz-in" rows="2" [(ngModel)]="recommandation" placeholder="Ex. Inspecter la conduite secondaire C-14 et contrôler la pompe SP-01."></textarea>

        <label class="wz-lbl">Prochaine action proposée</label>
        <input type="text" class="wz-in" [(ngModel)]="prochaineAction" placeholder="Ex. Programmer une inspection complémentaire.">

        <div class="wz-row">
          <div class="wz-tcol wz-grow">
            <label class="wz-lbl">Priorité de suivi</label>
            <div class="wz-segs wz-segs--wrap">
              <button *ngFor="let pr of PRIORITES" type="button" class="wz-seg wz-seg--gen" [class.wz-seg--on]="priorite()===pr" (click)="priorite.set(pr)">{{ pr }}</button>
            </div>
          </div>
        </div>
        <button type="button" class="wz-chk wz-chk--wide" [class.wz-chk--on]="suivi()" (click)="suivi.set(!suivi())">
          <span class="wz-box"><i *ngIf="suivi()" class="ti ti-check"></i></span>Un suivi complémentaire est nécessaire
        </button>
      </div>

      <!-- VALIDATION (pilier 7) -->
      <div *ngIf="key()==='validation'" class="wz-col">
        <div class="wz-recap">
          <div class="wz-recap__r"><span>Technicien</span><b>{{ technicien || '—' }}</b></div>
          <div class="wz-recap__r"><span>Commune · URD</span><b>{{ commune }}<span *ngIf="urd"> · {{ urd }}</span></b></div>
          <div class="wz-recap__r"><span>Type</span><b>{{ typeLabel() }}</b></div>
          <div class="wz-recap__r" *ngIf="selected()"><span>Élément lié</span><b>{{ selected()?.nom }}</b></div>
          <div class="wz-recap__r" *ngIf="resultat()"><span>Résultat</span><b>{{ resultat() }}</b></div>
        </div>
        <button type="button" class="wz-chk wz-chk--wide" [class.wz-chk--on]="certifie()" (click)="certifie.set(!certifie())">
          <span class="wz-box"><i *ngIf="certifie()" class="ti ti-check"></i></span>
          Je certifie l'exactitude des informations de ce rapport.
        </button>
        <div class="wz-note"><i class="ti ti-info-circle"></i> La signature numérique et la contre-signature du superviseur seront ajoutées au document officiel.</div>
      </div>

      <!-- APERÇU structuré (texte serveur + récap par piliers) → Soumettre -->
      <div *ngIf="key()==='apercu'" class="wz-col">
        <div *ngIf="!envoye()">
          <div *ngIf="generating()" class="wz-note"><i class="ti ti-loader"></i> Génération du rapport…</div>
          <div *ngIf="genError()" class="wz-block">
            <i class="ti ti-alert-triangle"></i>
            <div style="flex:1">{{ genError() }}</div>
            <button type="button" class="wz-btn wz-btn--primary" (click)="relancerGeneration()"><i class="ti ti-refresh"></i> Réessayer</button>
          </div>
          <div *ngIf="!generating() && !genError()" class="wz-preview">
            <div class="wz-preview__h"><i class="ti ti-sparkles"></i> RAPPORT GÉNÉRÉ AUTOMATIQUEMENT</div>
            <p class="wz-preview__p">{{ resumeAuto() || 'Aucun aperçu — complétez les étapes précédentes.' }}</p>
          </div>

          <div class="wz-doc" *ngIf="!generating() && !genError()">
            <div class="wz-doc__sec" *ngIf="contexteMission() || dureeCalc()">
              <div class="wz-doc__h">Contexte temporel</div>
              <div class="wz-doc__b">
                <span *ngIf="dureeCalc()">{{ heureDebut }}–{{ heureFin }} ({{ dureeCalc() }})</span>
                <span *ngIf="contexteMission()"> · {{ contexteMission() }}</span>
                <span *ngIf="conditions().size"> · {{ joinSet(conditions()) }}</span>
              </div>
            </div>
            <div class="wz-doc__sec" *ngIf="problemes().size || impact() || cause">
              <div class="wz-doc__h">Diagnostic</div>
              <div class="wz-doc__b">
                <span>État : {{ etat() }}</span>
                <span *ngIf="problemes().size"> · {{ joinSet(problemes()) }}</span>
                <span *ngIf="impact()"> · impact {{ impact() }}</span>
                <span *ngIf="population"> · ~{{ population }} ménages</span>
              </div>
            </div>
            <div class="wz-doc__sec" *ngIf="activites().size || resultat()">
              <div class="wz-doc__h">Opérations</div>
              <div class="wz-doc__b">
                <span *ngIf="activites().size">{{ joinSet(activites()) }}</span>
                <span *ngIf="resultat()"> · résultat : {{ resultat() }}</span>
              </div>
            </div>
            <div class="wz-doc__sec" *ngIf="aucunMateriel() || pieces().size || consommables().size || outils().size">
              <div class="wz-doc__h">Matériaux</div>
              <div class="wz-doc__b">
                <span *ngIf="aucunMateriel()">Aucun matériel utilisé</span>
                <span *ngIf="!aucunMateriel()">{{ joinSet(pieces(), consommables(), outils()) || '—' }}</span>
              </div>
            </div>
            <div class="wz-doc__sec" *ngIf="recommandation || suivi()">
              <div class="wz-doc__h">Recommandations</div>
              <div class="wz-doc__b">
                <span *ngIf="recommandation">{{ recommandation }}</span>
                <span *ngIf="suivi()"> · suivi requis<span *ngIf="priorite()"> (priorité {{ priorite() }})</span></span>
              </div>
            </div>
            <div class="wz-doc__sec" *ngIf="photos().length">
              <div class="wz-doc__h">Photos</div>
              <div class="wz-doc__b">{{ photos().length }} cliché(s) joint(s)</div>
            </div>
          </div>
          <div class="wz-meta">Titre : <b>{{ titre() }}</b> · {{ typeLabel() }} · {{ commune }}</div>
        </div>

        <div *ngIf="envoye()" class="wz-done">
          <i class="ti ti-circle-check"></i>
          <div>
            <div class="wz-done__t">Rapport soumis avec succès</div>
            <div class="wz-done__s">Statut : en attente de validation du superviseur.</div>
          </div>
        </div>
      </div>

    </div>

    <!-- Pied -->
    <div class="wz-foot">
      <div class="wz-save"><i class="ti ti-device-floppy"></i> <span *ngIf="draftId()">Brouillon auto-sauvé</span><span *ngIf="!draftId()">Brouillon non enregistré</span> · Étape {{ step() }} / {{ steps().length }}</div>
      <div class="wz-foot__btns">
        <button *ngIf="step() > 1 && !envoye()" class="wz-btn wz-btn--ghost" (click)="prev()"><i class="ti ti-chevron-left"></i> Précédent</button>
        <button *ngIf="key()!=='apercu'" class="wz-btn wz-btn--primary" [disabled]="!peutAvancer()" (click)="next()">Suivant <i class="ti ti-chevron-right"></i></button>
        <button *ngIf="key()==='apercu' && !envoye()" class="wz-btn wz-btn--send" [disabled]="!draftId() || submitting()" (click)="soumettre()">
          <i class="ti ti-send"></i> Soumettre au superviseur
        </button>
        <button *ngIf="envoye()" class="wz-btn wz-btn--primary" (click)="fermer.emit()">Fermer</button>
      </div>
    </div>

  </div>
</div>
  `,
  styles: [`
    .wz-backdrop { position:fixed; inset:0; background:rgba(2,5,12,.62); display:flex; align-items:flex-start; justify-content:center; padding:3vh 0; z-index:1000; overflow:auto; }
    .wz { width:660px; max-width:94vw; background:#0e131c; border:1px solid rgba(96,165,250,.16); border-radius:14px; overflow:hidden; color:#e2e8ee; box-shadow:0 24px 60px rgba(0,0,0,.5); }

    .wz-head { display:flex; align-items:flex-start; justify-content:space-between; padding:14px 18px; border-bottom:1px solid rgba(255,255,255,.07); }
    .wz-head__l { display:flex; align-items:center; gap:10px; }
    .wz-head__ic { font-size:20px; color:#60a5fa; }
    .wz-head__t { font-size:15px; font-weight:500; }
    .wz-head__s { font-size:11px; color:#8b9aab; margin-top:2px; }
    .wz-x { font-size:18px; color:#8b9aab; cursor:pointer; }
    .wz-x:hover { color:#e2e8ee; }

    .wz-lock { display:flex; align-items:center; gap:8px; padding:9px 18px; background:rgba(96,165,250,.10); border-bottom:1px solid rgba(96,165,250,.14); font-size:12px; color:#9cc4fb; }
    .wz-lock i { font-size:14px; }

    .wz-steps { display:flex; align-items:center; padding:13px 18px; border-bottom:1px solid rgba(255,255,255,.07); gap:3px; overflow-x:auto; }
    .wz-step { display:flex; align-items:center; gap:6px; }
    .wz-step__n { width:21px; height:21px; border-radius:50%; border:1px solid rgba(255,255,255,.2); color:#8b9aab; font-size:11px; display:flex; align-items:center; justify-content:center; flex:0 0 auto; }
    .wz-step__l { font-size:11px; color:#8b9aab; white-space:nowrap; }
    .wz-step--on .wz-step__n { border-color:#60a5fa; color:#60a5fa; font-weight:600; }
    .wz-step--on .wz-step__l { color:#e2e8ee; font-weight:500; }
    .wz-step--done .wz-step__n { background:#60a5fa; border-color:#60a5fa; color:#04101f; }
    .wz-step__sep { flex:1; height:1px; background:rgba(255,255,255,.1); margin:0 3px; min-width:6px; }

    .wz-body { padding:18px; min-height:240px; max-height:62vh; overflow-y:auto; }
    .wz-col { display:flex; flex-direction:column; gap:9px; }
    .wz-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .wz-row { display:flex; gap:10px; align-items:flex-start; }
    .wz-tcol { display:flex; flex-direction:column; gap:4px; }
    .wz-tcol.wz-grow { flex:1; }
    .wz-tlbl { font-size:11px; color:#8b9aab; }

    .wz-lbl { font-size:12px; color:#9aa7b8; margin-top:4px; }
    .wz-in { font-size:13px; color:#e2e8ee; background:#080b14; border:1px solid rgba(255,255,255,.13); border-radius:8px; padding:8px 11px; font-family:inherit; outline:none; resize:vertical; width:100%; box-sizing:border-box; }
    .wz-in:focus { border-color:#60a5fa; }
    .wz-note { display:flex; align-items:center; gap:7px; font-size:12px; color:#9cc4fb; background:rgba(96,165,250,.08); border-radius:8px; padding:8px 11px; }

    .wz-recap { display:flex; flex-direction:column; gap:5px; background:#080b14; border:1px solid rgba(255,255,255,.1); border-radius:9px; padding:11px 13px; }
    .wz-recap__r { display:flex; justify-content:space-between; font-size:12.5px; }
    .wz-recap__r span { color:#8b9aab; } .wz-recap__r b { color:#e2e8ee; font-weight:500; }

    .wz-card { display:flex; flex-direction:column; align-items:center; gap:6px; padding:14px 8px; background:#080b14; border:1px solid rgba(255,255,255,.12); border-radius:10px; color:#c7d2de; font-size:13px; cursor:pointer; font-family:inherit; }
    .wz-card i { font-size:20px; color:#60a5fa; }
    .wz-card:hover { border-color:rgba(96,165,250,.4); }
    .wz-card--on { border-color:#60a5fa; background:rgba(96,165,250,.12); color:#fff; }

    .wz-segs { display:flex; gap:8px; }
    .wz-segs--wrap { flex-wrap:wrap; }
    .wz-seg { flex:1; min-width:fit-content; text-align:center; padding:9px; border:1px solid rgba(255,255,255,.13); border-radius:8px; font-size:12.5px; color:#c7d2de; background:transparent; cursor:pointer; font-family:inherit; white-space:nowrap; }
    .wz-seg--on { font-weight:600; }
    .wz-seg--on[data-e="Normal"]   { border-color:#34d399; background:rgba(52,211,153,.14); color:#34d399; }
    .wz-seg--on[data-e="Perturbé"] { border-color:#fbbf24; background:rgba(245,158,11,.16); color:#fbbf24; }
    .wz-seg--on[data-e="Critique"] { border-color:#f87171; background:rgba(248,113,113,.16); color:#f87171; }
    .wz-seg--gen.wz-seg--on { border-color:#60a5fa; background:rgba(96,165,250,.14); color:#9cc4fb; }

    .wz-chk { display:flex; align-items:center; gap:8px; padding:7px 9px; background:#080b14; border:1px solid rgba(255,255,255,.1); border-radius:8px; font-size:12.5px; color:#9aa7b8; cursor:pointer; font-family:inherit; text-align:left; }
    .wz-chk--wide { width:100%; }
    .wz-box { width:18px; height:18px; flex:0 0 auto; border:1px solid rgba(255,255,255,.2); border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:11px; }
    .wz-chk--on { color:#e2e8ee; border-color:rgba(96,165,250,.5); }
    .wz-chk--on .wz-box { background:#60a5fa; border-color:#60a5fa; color:#04101f; }
    .wz-chk--danger.wz-chk--on { color:#f3b6b6; border-color:rgba(248,113,113,.5); }
    .wz-chk--danger.wz-chk--on .wz-box { background:#f87171; border-color:#f87171; }

    .wz-elems { display:flex; flex-direction:column; gap:7px; max-height:260px; overflow:auto; }
    .wz-elem { display:flex; align-items:center; gap:10px; padding:10px 12px; background:#080b14; border:1px solid rgba(255,255,255,.1); border-radius:9px; cursor:pointer; font-family:inherit; text-align:left; }
    .wz-elem:hover { border-color:rgba(96,165,250,.4); }
    .wz-elem--on { border-color:#60a5fa; background:rgba(96,165,250,.1); }
    .wz-elem--on .wz-box { background:#60a5fa; border-color:#60a5fa; color:#04101f; }
    .wz-elem__txt { display:flex; flex-direction:column; min-width:0; }
    .wz-elem__n { font-size:13.5px; color:#e2e8ee; font-weight:500; }
    .wz-elem__s { font-size:11.5px; color:#8b9aab; margin-top:1px; }
    .wz-empty { display:flex; align-items:center; gap:8px; font-size:12.5px; color:#fbbf24; background:rgba(245,158,11,.08); border:1px solid rgba(245,158,11,.2); border-radius:9px; padding:11px; }
    .wz-empty i { font-size:15px; }
    .wz-block { display:flex; align-items:flex-start; gap:9px; font-size:13px; line-height:1.5; color:#f3b6b6; background:rgba(248,113,113,.1); border:1px solid rgba(248,113,113,.32); border-radius:10px; padding:13px; }
    .wz-block i { font-size:17px; color:#f87171; margin-top:1px; flex:0 0 auto; }

    .wz-drop { border:1px dashed rgba(96,165,250,.4); border-radius:12px; padding:24px; text-align:center; color:#9aa7b8; cursor:pointer; }
    .wz-drop:hover { border-color:rgba(96,165,250,.7); }
    .wz-drop i { font-size:30px; color:#60a5fa; }
    .wz-drop__t { font-size:13px; color:#e2e8ee; margin-top:7px; }
    .wz-drop__s { font-size:11px; margin-top:3px; }

    .wz-photo-btns { display:flex; gap:8px; }
    .wz-pbtn { flex:1; display:flex; align-items:center; justify-content:center; gap:7px; padding:11px; background:#080b14; border:1px solid rgba(96,165,250,.3); border-radius:9px; color:#c7d2de; font-size:13px; cursor:pointer; font-family:inherit; }
    .wz-pbtn:hover { border-color:#60a5fa; color:#fff; }
    .wz-pbtn i { font-size:17px; color:#60a5fa; }
    .wz-plist { display:flex; flex-direction:column; gap:8px; }
    .wz-prow { display:flex; gap:10px; align-items:center; background:#080b14; border:1px solid rgba(255,255,255,.1); border-radius:9px; padding:8px; }
    .wz-prow img { width:54px; height:54px; object-fit:cover; border-radius:7px; flex:0 0 auto; }
    .wz-pmeta { display:flex; flex-direction:column; gap:5px; flex:1; min-width:0; }
    .wz-cat { font-size:11.5px; background:#0e131c; border:1px solid rgba(255,255,255,.14); border-radius:6px; color:#c7d2de; padding:5px 7px; font-family:inherit; outline:none; }
    .wz-cat:focus { border-color:#60a5fa; }
    .wz-cap { font-size:12px; background:#0e131c; border:1px solid rgba(255,255,255,.13); border-radius:6px; color:#e2e8ee; padding:5px 8px; font-family:inherit; outline:none; }
    .wz-cap:focus { border-color:#60a5fa; }
    .wz-prow__x { width:24px; height:24px; flex:0 0 auto; border-radius:6px; border:0; background:rgba(255,255,255,.06); color:#8b9aab; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:13px; }
    .wz-prow__x:hover { background:#f87171; color:#fff; }

    .wz-preview { border:1px solid rgba(96,165,250,.3); border-radius:12px; overflow:hidden; }
    .wz-preview__h { display:flex; align-items:center; gap:7px; padding:8px 12px; background:rgba(96,165,250,.12); font-size:11px; font-weight:600; color:#9cc4fb; letter-spacing:.04em; }
    .wz-preview__p { font-size:13.5px; line-height:1.62; color:#e2e8ee; margin:0; padding:13px; }
    .wz-meta { font-size:11px; color:#8b9aab; margin-top:9px; }

    .wz-doc { display:flex; flex-direction:column; gap:0; margin-top:10px; border:1px solid rgba(255,255,255,.09); border-radius:10px; overflow:hidden; }
    .wz-doc__sec { padding:9px 12px; border-bottom:1px solid rgba(255,255,255,.06); }
    .wz-doc__sec:last-child { border-bottom:0; }
    .wz-doc__h { font-size:10.5px; font-weight:600; color:#8b9aab; letter-spacing:.04em; text-transform:uppercase; margin-bottom:3px; }
    .wz-doc__b { font-size:12.5px; color:#d4dde8; line-height:1.5; }

    .wz-done { display:flex; align-items:center; gap:12px; padding:16px; border-radius:12px; background:rgba(52,211,153,.1); border:1px solid rgba(52,211,153,.26); }
    .wz-done i { font-size:26px; color:#34d399; }
    .wz-done__t { font-size:14px; font-weight:500; color:#34d399; } .wz-done__s { font-size:12px; color:#9aa7b8; margin-top:2px; }

    .wz-foot { display:flex; align-items:center; justify-content:space-between; padding:13px 18px; border-top:1px solid rgba(255,255,255,.07); gap:10px; }
    .wz-save { display:flex; align-items:center; gap:6px; font-size:11px; color:#34d399; }
    .wz-save i { font-size:14px; }
    .wz-foot__btns { display:flex; gap:8px; }
    .wz-btn { display:flex; align-items:center; gap:4px; font-size:13px; padding:8px 15px; border-radius:8px; cursor:pointer; font-family:inherit; border:1px solid transparent; }
    .wz-btn i { font-size:15px; }
    .wz-btn--ghost { color:#c7d2de; border-color:rgba(255,255,255,.14); background:transparent; }
    .wz-btn--primary { background:#60a5fa; color:#04101f; font-weight:500; }
    .wz-btn--send { background:#10b981; color:#04231c; font-weight:500; }
    .wz-btn:disabled { opacity:.45; cursor:not-allowed; }
  `],
})
export class SoumettreRapportComponent {
  @Output() fermer = new EventEmitter<void>();
  @Output() soumis = new EventEmitter<void>();

  private readonly store = inject(RapportsStore);
  private readonly auth = inject(AuthService);
  private readonly bff = inject(BffApiService);

  readonly TYPES = [
    { id: 'journalier',     label: 'Journalier',          icon: 'ti-calendar' },
    { id: 'ressource',      label: 'Recensement',         icon: 'ti-droplet' },
    { id: 'infrastructure', label: 'Inspection ouvrage',  icon: 'ti-building-factory-2' },
    { id: 'iot',            label: 'IoT / capteur',       icon: 'ti-cpu' },
    { id: 'intervention',   label: 'Intervention',        icon: 'ti-tool' },
    { id: 'incident',       label: 'Incident / urgence',  icon: 'ti-alert-triangle' },
  ];

  // ── Référentiels guidés (le technicien clique) ─────────────────────────────
  readonly ETATS      = ['Normal', 'Perturbé', 'Critique'];
  readonly CONTEXTES  = ['Planifiée', 'Suite à alerte', 'Contrôle de routine', 'Urgence'];
  readonly CONDITIONS = ['Accès normal', 'Accès difficile', 'Pluie', 'Zone sensible', 'Panne électrique', 'Autre'];
  readonly IMPACTS    = ['Faible', 'Moyen', 'Élevé', 'Critique'];
  readonly ACTIVITES  = ['Inspection visuelle', 'Vérification capteur', 'Nettoyage', 'Réglage de vanne', 'Remplacement de pièce', 'Purge de conduite', 'Redémarrage pompe', 'Relevé de données'];
  readonly PROBLEMES  = ['Fuite', 'Faible pression', 'Pompe en panne', 'Capteur hors ligne', 'Eau trouble', 'Vanne bloquée', 'Câble endommagé', 'Aucun problème majeur'];
  readonly TESTS      = ['Test de pression', 'Test de débit', 'Test qualité eau', 'Vérification capteur', 'Test de continuité', 'Relevé compteur'];
  readonly RESULTATS  = ['Résolu', 'Amélioré', 'Temporairement stabilisé', 'Non résolu', 'À escalader'];
  readonly PIECES       = ['Joint de vanne', 'Tuyau / raccord', 'Pièce de pompe', 'Capteur / sonde', 'Câble électrique', 'Robinet / vanne'];
  readonly CONSOMMABLES = ['Ruban d\'étanchéité', 'Colle PVC', 'Lubrifiant', 'Produit de traitement', 'Visserie'];
  readonly OUTILS       = ['Clé de serrage', 'Manomètre', 'Multimètre', 'Perceuse', 'Kit de soudure'];
  readonly PRIORITES  = ['Basse', 'Moyenne', 'Haute', 'Urgente'];
  readonly CATEGORIES = ['Avant', 'Pendant', 'Après', 'Pièce', 'Capteur'];

  // ── État du wizard ─────────────────────────────────────────────────────────
  readonly step = signal(1);
  readonly type = signal<string>('intervention');

  /** Étapes actives selon le type (intervention = modèle complet). */
  readonly steps = computed(() =>
    (STEPS_BY_TYPE[this.type()] ?? STEPS_BY_TYPE['infrastructure']).map(k => ({ key: k, label: STEP_LABELS[k] })));
  /** Clé de l'étape courante (pilote l'affichage du corps + le pied). */
  readonly key = computed(() => this.steps()[this.step() - 1]?.key ?? 'type');

  // Pilier 2 — contexte temporel
  heureArrivee = '';
  heureDebut = '';
  heureFin = '';
  readonly contexteMission = signal<string>('');
  readonly conditions = signal<Set<string>>(new Set());

  // Pilier 3 — diagnostic
  readonly etat = signal<string>('Normal');
  readonly problemes = signal<Set<string>>(new Set());
  readonly impact = signal<string>('');
  population = '';
  cause = '';

  // Pilier 4 — opérations
  readonly activites = signal<Set<string>>(new Set());
  readonly tests = signal<Set<string>>(new Set());
  readonly resultat = signal<string>('');

  // Pilier 5 — matériaux
  readonly pieces = signal<Set<string>>(new Set());
  readonly consommables = signal<Set<string>>(new Set());
  readonly outils = signal<Set<string>>(new Set());
  readonly aucunMateriel = signal<boolean>(false);

  // Pilier 6 — observations
  observation = '';
  recommandation = '';
  prochaineAction = '';
  readonly suivi = signal<boolean>(false);
  readonly priorite = signal<string>('');

  // Pilier 7 — validation
  readonly certifie = signal<boolean>(false);

  // Contexte (liste scopée commune) + photos
  readonly elements = signal<ElementContexte[]>([]);
  readonly selected = signal<ElementContexte | null>(null);
  readonly loadingElems = signal(false);
  readonly photos = signal<PhotoItem[]>([]);

  readonly draftId = signal<string | null>(null);
  readonly resumeAuto = signal<string>('');
  readonly generating = signal(false);
  /** Message d'échec de génération (sinon un 4xx/5xx/hang laisserait le spinner tourner). */
  readonly genError = signal<string>('');
  readonly submitting = signal(false);
  readonly envoye = signal(false);

  readonly typeLabel = computed(() => this.TYPES.find(t => t.id === this.type())?.label ?? this.type());
  readonly titre = computed(() => {
    const base = `Rapport ${this.typeLabel().toLowerCase()}`;
    const el = this.selected()?.nom;
    return el ? `${base} — ${el}` : `${base} — ${this.commune || 'terrain'}`;
  });

  // ── Scope verrouillé (affectation du token) ────────────────────────────────
  get commune(): string { return this.auth.userSnapshot()?.commune ?? ''; }
  get urd(): string { return this.auth.userSnapshot()?.dept ?? ''; }
  get technicien(): string { return this.auth.userSnapshot()?.nom ?? ''; }

  // ── Source de la liste de contexte selon le type ───────────────────────────
  sourceFor(type: string): 'capteur' | 'ouvrage' | 'ressource' | 'intervention' | 'alerte' | 'aucun' {
    switch (type) {
      case 'iot':            return 'capteur';
      case 'ressource':      return 'ressource';
      case 'infrastructure': return 'ouvrage';
      case 'intervention':   return 'intervention';
      case 'incident':       return 'alerte';
      case 'journalier':     return 'aucun';
      default:               return 'ouvrage';
    }
  }

  /** Types « durs » : un rapport d'intervention/incident NE PEUT PAS exister sans son prérequis. */
  gated(type: string): boolean {
    return type === 'intervention' || type === 'incident';
  }

  private readonly LABELS: Record<string, [string, string]> = {
    capteur:      ['capteur', 'Capteurs'],
    ouvrage:      ['ouvrage', 'Ouvrages'],
    ressource:    ['ressource', 'Ressources'],
    intervention: ['intervention', 'Interventions'],
    alerte:       ['alerte', 'Alertes'],
    aucun:        ['', 'Éléments'],
  };
  sourceLabel(): string { return this.LABELS[this.sourceFor(this.type())][0]; }
  sourceLabelPluriel(): string { return this.LABELS[this.sourceFor(this.type())][1]; }

  blocageMessage(): string {
    return this.type() === 'intervention'
      ? "Aucune intervention disponible dans votre périmètre. Créez ou traitez d'abord une alerte pour générer une intervention."
      : "Aucune alerte à traiter dans votre commune. Une alerte doit exister avant de soumettre un rapport d'incident.";
  }

  // ── Interactions ───────────────────────────────────────────────────────────
  /** Changer de type réinitialise le parcours (le nombre d'étapes dépend du type). */
  choisirType(id: string): void {
    if (id === this.type()) return;
    this.type.set(id);
    this.step.set(1);
    this.draftId.set(null);
    this.resumeAuto.set('');
    this.selected.set(null);
  }

  toggle(sig: { (): Set<string>; set: (v: Set<string>) => void }, val: string): void {
    const next = new Set(sig());
    next.has(val) ? next.delete(val) : next.add(val);
    sig.set(next);
  }

  /** « Aucun matériel » exclusif : cocher vide les sélections de matériel. */
  toggleAucun(): void {
    const v = !this.aucunMateriel();
    this.aucunMateriel.set(v);
    if (v) { this.pieces.set(new Set()); this.consommables.set(new Set()); this.outils.set(new Set()); }
  }

  /** Durée HH:MM → « 1h15 » / « 45min », vide si incohérent. */
  dureeCalc(): string {
    const mins = (s: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s); return m ? (+m[1]) * 60 + (+m[2]) : null; };
    const a = mins(this.heureDebut), b = mins(this.heureFin);
    if (a == null || b == null || b < a) return '';
    const d = b - a, h = Math.floor(d / 60), mn = d % 60;
    return h > 0 ? `${h}h${mn > 0 ? String(mn).padStart(2, '0') : ''}` : `${mn}min`;
  }

  joinSet(...sets: Set<string>[]): string {
    return sets.flatMap(s => [...s]).join(', ');
  }

  onPhotos(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (!input.files) return;
    const added = Array.from(input.files).map(f => ({ url: URL.createObjectURL(f), name: f.name, categorie: 'Pendant', legende: '' }));
    this.photos.update(list => [...list, ...added]);
    input.value = '';
  }

  removePhoto(i: number): void {
    this.photos.update(list => {
      const removed = list[i];
      if (removed) URL.revokeObjectURL(removed.url);
      return list.filter((_, idx) => idx !== i);
    });
  }

  peutAvancer(): boolean {
    const k = this.key();
    if (k === 'type') return !!this.type();
    if (k === 'identification') {
      if (this.sourceFor(this.type()) === 'aucun') return true;
      if (this.elements().length === 0) return !this.gated(this.type());
      return this.selected() !== null;
    }
    if (k === 'validation') return this.certifie();
    return true; // étapes optionnelles : on n'oblige rien (le technicien clique vite)
  }

  private contenuJson(): string {
    return JSON.stringify({
      // Pilier 1/3 (existant)
      etat_general: this.etat(),
      activites: [...this.activites()],
      problemes_observes: [...this.problemes()],
      infrastructure: this.selected()?.nom ?? '',
      element_id: this.selected()?.id ?? null,
      observation_courte: this.observation.trim(),
      photos_count: this.photos().length,
      // Pilier 2 — contexte temporel
      heure_arrivee: this.heureArrivee,
      heure_debut: this.heureDebut,
      heure_fin: this.heureFin,
      duree: this.dureeCalc(),
      contexte_mission: this.contexteMission(),
      conditions: [...this.conditions()],
      // Pilier 3 — impact / cause
      impact: this.impact(),
      population_impactee: this.population.trim(),
      cause_probable: this.cause.trim(),
      // Pilier 4 — opérations
      tests: [...this.tests()],
      resultat_final: this.resultat(),
      // Pilier 5 — matériaux
      materiaux: {
        pieces: [...this.pieces()],
        consommables: [...this.consommables()],
        outils: [...this.outils()],
        aucun: this.aucunMateriel(),
      },
      // Pilier 6 — observations / recommandations
      recommandation: this.recommandation.trim(),
      suivi_necessaire: this.suivi(),
      prochaine_action: this.prochaineAction.trim(),
      priorite: this.priorite(),
      // Photos catégorisées
      photos: this.photos().map(p => ({ categorie: p.categorie, legende: p.legende.trim() })),
    });
  }

  next(): void {
    const keys = this.steps().map(s => s.key);
    if (keys[this.step() - 1] === 'type') this.chargerElements();
    const nextIdx = Math.min(keys.length, this.step() + 1);
    if (keys[nextIdx - 1] === 'apercu') { this.genererApercu(nextIdx); return; }
    this.step.set(nextIdx);
  }
  prev(): void { this.step.update(s => Math.max(1, s - 1)); }

  /** Charge les éléments de la commune (scopés serveur par le token) correspondant au type. */
  private chargerElements(): void {
    this.selected.set(null);
    this.elements.set([]);
    const src = this.sourceFor(this.type());
    if (src === 'aucun') return;
    this.loadingElems.set(true);
    const obs: any =
      src === 'capteur'      ? this.bff.listCapteurs() :
      src === 'ressource'    ? this.bff.listRessources() :
      src === 'intervention' ? this.bff.tickets() :
      src === 'alerte'       ? this.bff.alerts() :
                               this.bff.listOuvrages();
    obs.pipe(catchError(() => of([] as any[]))).subscribe((rows: any[]) => {
      this.elements.set((rows ?? []).map((r: any) => this.toElement(src, r)));
      this.loadingElems.set(false);
    });
  }

  private toElement(src: string, r: any): ElementContexte {
    switch (src) {
      case 'capteur':
        return { id: r.id, nom: r.nom, sous: [r.code, r.type].filter(Boolean).join(' · ') };
      case 'ressource':
        return { id: r.id, nom: r.nom, sous: [r.code, r.type, r.etat].filter(Boolean).join(' · ') };
      case 'intervention':
        return { id: String(r.id), nom: r.titre || r.pointId || `Intervention #${r.id}`,
                 sous: [r.status, r.alertId ? `ALT-${r.alertId}` : null, r.assignee].filter(Boolean).join(' · ') };
      case 'alerte':
        return { id: String(r.id), nom: r.message || r.titre || `Alerte #${r.id}`,
                 sous: [r.severity, r.status, r.type].filter(Boolean).join(' · ') };
      default:
        return { id: r.id, nom: r.nom, sous: [r.code, r.type, r.etat].filter(Boolean).join(' · ') };
    }
  }

  private genererApercu(idx: number): void {
    this.step.set(idx);
    if (this.draftId()) return; // déjà créé : ne pas dupliquer
    this.relancerGeneration();
  }

  /** Lance (ou relance) la création du brouillon + génération du resumeAuto. Gère l'échec :
   *  un 4xx/5xx/timeout coupe le spinner et affiche une erreur réessayable (jamais figé). */
  relancerGeneration(): void {
    if (this.generating() || this.draftId()) return;
    this.genError.set('');
    this.generating.set(true);
    const sel = this.selected();
    const interventionId = this.type() === 'intervention' && sel ? Number(sel.id) : undefined;
    this.store.creer(
      { titre: this.titre(), type: this.type(), contenuJson: this.contenuJson(), interventionId },
      (r) => { this.draftId.set(r.id); this.resumeAuto.set(r.resumeAuto ?? ''); this.generating.set(false); },
      () => { this.generating.set(false); this.genError.set('Échec de la génération du rapport. Vérifiez votre connexion et réessayez.'); },
    );
  }

  soumettre(): void {
    const id = this.draftId();
    if (!id || this.submitting()) return;
    this.submitting.set(true);
    this.store.transmettre(id);
    this.envoye.set(true);
    this.submitting.set(false);
    this.soumis.emit();
  }
}
