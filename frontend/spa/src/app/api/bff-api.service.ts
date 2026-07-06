import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';

export interface UserProfileDto {
  username: string; nom: string; email: string; telephone: string;
  fonction: string; role: string; initiales: string;
  urdId: string; orepa: string; dept: string;
  permissions: string; statut: string; createdAt: string;
}

export interface RessourceDepartementDto {
  departementId: string; estPrincipal: boolean; quotePartDebit: number;
}

export type RessourceStatutDto = 'EN_ATTENTE_VALIDATION' | 'VALIDEE' | 'REJETEE';

export interface RessourceDto {
  id: string; code: string; nom: string;
  type: 'SOURCE' | 'RIVIERE' | 'BASSIN';
  etat: 'SAINE' | 'MENACEE' | 'POLLUEE';
  debitM3h: number | null; lat: number | null; lon: number | null;
  commune: string | null; section: string | null;
  departements: RessourceDepartementDto[];
  statut: RessourceStatutDto; createdBy: string | null;
  validatedBy: string | null; validatedAt: string | null; motifRejet: string | null;
  createdAt: string;
}

export interface RessourceKpiDto {
  patrimoine: number; debitM3h: number; menace: number;
}

export type OuvrageTypeDto = 'CAPTAGE' | 'FORAGE' | 'PUITS' | 'POMPAGE' | 'TRAITEMENT' | 'RESERVOIR' | 'RESEAU' | 'BORNE';
export type OuvrageEtatDto = 'OPERATIONNEL' | 'MAINTENANCE' | 'PANNE' | 'VETUSTE';
export type OuvrageStatutDto = 'EN_ATTENTE_VALIDATION' | 'VALIDEE' | 'REJETEE';

export interface OuvrageDto {
  id: string; code: string; nom: string;
  type: OuvrageTypeDto; etat: OuvrageEtatDto;
  department: string; commune: string | null; section: string | null; locality: string | null;
  lat: number | null; lon: number | null;
  capaciteM3h: number | null; anneeConstruction: number | null;
  resourceId: string | null; resourceName: string | null; notes: string | null;
  statut: OuvrageStatutDto; createdBy: string | null;
  validatedBy: string | null; validatedAt: string | null; motifRejet: string | null;
  createdAt: string;
}

/** Capteur DÉRIVÉ (vue carte/accueil) — point de mesure + dernière mesure + alerte. */
export interface CapteurDeriveDto {
  pointId: string; nom: string; type: string; commune: string | null; departement: string;
  lat: number | null; lon: number | null;
  etat: string; mesure: string; derniereMesure: string | null;
}

export type CapteurTypeDto = 'PRESSION' | 'NIVEAU' | 'DEBIT' | 'QUALITE';
export type CapteurStatutDto = 'EN_ATTENTE_VALIDATION' | 'VALIDEE' | 'REJETEE';

export interface CapteurDto {
  id: string; code: string; nom: string; type: CapteurTypeDto;
  commune: string | null; departement: string;
  ouvrageId: string | null; ouvrageNom: string | null;
  deviceId: string | null; mqttTopic: string | null; unit: string | null;
  lat: number | null; lon: number | null;
  etat: string; mesure: string;
  lastValue: number | null; battery: number | null; signal: number | null; derniereMesure: string | null;
  statut: CapteurStatutDto; createdBy: string | null;
  validatedBy: string | null; validatedAt: string | null; motifRejet: string | null;
  createdAt: string;
}

export type RapportStatusDto = 'BROUILLON' | 'GENERE' | 'TRANSMIS' | 'VALIDE' | 'TRANSMIS_ADMIN' | 'ARCHIVE';

export interface RapportDto {
  id: string; titre: string; type: string; status: RapportStatusDto;
  departementId: string | null; national: boolean; commune: string | null;
  auteur: string | null; auteurUsername: string | null; pages: number | null;
  transmisLe: string | null; motifRenvoi: string | null;
  contenuJson: string | null; resumeAuto: string | null;
  validePar: string | null; valideLe: string | null;
  signataire: string | null; signeLe: string | null;
  interventionId: number | null;
  createdAt: string;
}

/** Couche d'examen du superviseur, gelée dans le snapshot signé à la validation (cf. backend ValiderRequest). */
export interface ValiderExamenDto {
  attCompletude: boolean; attCoherence: boolean; attTerritorialite: boolean;
  prioriteReevaluee: string | null; commentaire: string | null;
}

export interface ZoneDto {
  id: string; code: string | null; nom: string; commune: string | null; departementId: string;
  statut: 'A_DEPLOYER' | 'ACTIVE' | 'SUSPENDUE'; populationCible: number | null;
  activeePar: string | null; dateActivation: string | null;
}

export type ActeurTypeDto = 'TEPAC' | 'OPERATEUR' | 'CAEPA' | 'MAIRIE' | 'PARTENAIRE';

export interface ActeurDto {
  id: string; type: ActeurTypeDto; nom: string; departementId: string;
  commune: string | null; sousType: string | null; maitreOuvrage: string | null;
  typeContrat: string | null; periodeDebut: number | null; periodeFin: number | null;
  ouvrageIds: string | null; zoneId: string | null; responsable: string | null;
  contactTel: string | null; compteUsername: string | null; statut: string; createdAt: string;
}

// ── Intervention (ordre de travail) : contrat DTO ──
export interface InterventionTacheDto {
  id: number; ticketId: number; libelle: string; obligatoire: boolean; ordre: number;
  statut: 'A_FAIRE' | 'FAIT' | 'NON_APPLICABLE'; commentaire: string | null; completedAt: string | null;
}

export interface AffectationDto {
  id: number; ticketId: number; personneUsername: string; personneNom: string;
  commune: string | null; ouverte: boolean; role: 'PRINCIPAL' | 'APPUI';
  statut: 'ASSIGNE' | 'ACCEPTE' | 'REFUSE'; createdAt: string | null; closedAt: string | null;
}

export interface PhotoDto {
  id: number; ticketId: number; type: string; url: string | null; contentType: string | null;
  commentaire: string | null; latitude: number | null; longitude: number | null; takenAt: string | null;
}

/** Payload de création d'une intervention (miroir de CreateInterventionRequest côté serveur). */
export interface CreateInterventionPayload {
  type?: string; priorite?: string; titre?: string; commune: string;
  ouvrageId?: string | null; capteurId?: string | null;
  datePrevue?: string | null; heurePrevue?: string | null; dureeMinutes?: number | null;
  consignes?: string | null; resultatAttendu?: string | null; materiel?: string | null; risques?: string | null;
  assignee?: string | null;
  taches?: { libelle: string; obligatoire?: boolean }[];
}

@Injectable({ providedIn: 'root' })
export class BffApiService {
  private readonly baseUrl = 'http://localhost:9083/api';

  constructor(private readonly http: HttpClient) {}

  createAccount(payload: { username: string; password: string; roles: string }) {
    return this.http.post<{ username: string; roles: string; active: boolean }>(
      `${this.baseUrl}/auth/accounts`, payload
    );
  }

  // ── User profiles — source unique DINEPA ─────────────────────────

  createUser(payload: {
    username: string; password: string;
    nom: string; email: string; telephone: string; fonction: string;
    role: string; urdId?: string; orepa?: string; dept?: string;
    permissions?: string; createdBy?: string;
  }) {
    return this.http.post<UserProfileDto>(`${this.baseUrl}/users`, payload);
  }

  listUsers(urdId?: string) {
    const params = urdId ? { params: { urdId } } : {};
    return this.http.get<UserProfileDto[]>(`${this.baseUrl}/users`, params);
  }

  // ── Ressources naturelles — persistance durable (api-metier) ──────

  listRessources(departementId?: string) {
    const params = departementId ? { params: { departementId } } : {};
    return this.http.get<RessourceDto[]>(`${this.baseUrl}/ressources`, params);
  }

  ressourceKpi(departementId?: string) {
    const params = departementId ? { params: { departementId } } : {};
    return this.http.get<RessourceKpiDto>(`${this.baseUrl}/ressources/kpi`, params);
  }

  createRessource(payload: {
    id?: string; code?: string; nom: string;
    type: string; etat?: string;
    debitM3h?: number | null; lat?: number | null; lon?: number | null;
    commune?: string | null; section?: string | null;
    departementPrincipal: string; departementsTraverses?: string[]; createdBy?: string;
  }) {
    return this.http.post<RessourceDto>(`${this.baseUrl}/ressources`, payload);
  }

  /** Superviseur d'URD : valide un recensement → la ressource devient officielle. */
  validerRessource(id: string) {
    return this.http.patch<RessourceDto>(`${this.baseUrl}/ressources/${id}/valider`, {});
  }

  /** Superviseur d'URD : rejette un recensement (motif obligatoire). */
  rejeterRessource(id: string, motif: string) {
    return this.http.patch<RessourceDto>(`${this.baseUrl}/ressources/${id}/rejeter`, { motif });
  }

  // ── Infrastructures (patrimoine bâti) — persistance durable + cycle de validation ──

  listOuvrages(departementId?: string) {
    const params = departementId ? { params: { departementId } } : {};
    return this.http.get<OuvrageDto[]>(`${this.baseUrl}/ouvrages`, params);
  }

  createOuvrage(payload: {
    id?: string; code?: string; nom: string;
    type: string; etat?: string;
    department?: string; commune?: string | null; section?: string | null; locality?: string | null;
    lat?: number | null; lon?: number | null;
    capaciteM3h?: number | null; anneeConstruction?: number | null;
    resourceId?: string | null; resourceName?: string | null; notes?: string | null; createdBy?: string;
  }) {
    return this.http.post<OuvrageDto>(`${this.baseUrl}/ouvrages`, payload);
  }

  /** Superviseur d'URD : valide une soumission → l'ouvrage devient officiel. */
  validerOuvrage(id: string) {
    return this.http.patch<OuvrageDto>(`${this.baseUrl}/ouvrages/${id}/valider`, {});
  }

  /** Superviseur d'URD : rejette une soumission (motif obligatoire). */
  rejeterOuvrage(id: string, motif: string) {
    return this.http.patch<OuvrageDto>(`${this.baseUrl}/ouvrages/${id}/rejeter`, { motif });
  }

  // ── Acteurs de la gouvernance — persistance durable (api-metier) ──

  listActeurs(departementId?: string) {
    const params = departementId ? { params: { departementId } } : {};
    return this.http.get<ActeurDto[]>(`${this.baseUrl}/acteurs`, params);
  }

  createActeur(payload: {
    id?: string; type: ActeurTypeDto; nom: string; departementId: string;
    commune?: string | null; sousType?: string | null; maitreOuvrage?: string | null;
    typeContrat?: string | null; periodeDebut?: number | null; periodeFin?: number | null;
    ouvrageIds?: string | null; zoneId?: string | null; responsable?: string | null;
    contactTel?: string | null; statut?: string;
    compteUsername?: string | null; comptePassword?: string | null; compteEmail?: string | null;
  }) {
    return this.http.post<ActeurDto>(`${this.baseUrl}/acteurs`, payload);
  }

  /** Archivage soft-delete (admin partout, superviseur sur son département côté serveur). */
  deleteActeur(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/acteurs/${id}`);
  }

  /** Suspendre / réactiver un acteur (coupe ou rétablit le compte de connexion lié). */
  changerStatutActeur(id: string, statut: 'actif' | 'suspendu') {
    return this.http.patch<ActeurDto>(`${this.baseUrl}/acteurs/${id}/statut`, { statut });
  }

  // ── Rapports — scopés à l'URD (serveur), workflow Brouillon→…→Validé ──

  listRapports(departementId?: string, status?: RapportStatusDto) {
    let params = new HttpParams();
    if (departementId) params = params.set('departementId', departementId);
    if (status) params = params.set('status', status);
    return this.http.get<RapportDto[]>(`${this.baseUrl}/rapports`, { params });
  }

  /** Transmis → Validé (décision du superviseur). Persiste d'abord, l'UI suit. */
  /** Valide (TRANSMIS → VALIDE) en gelant la couche d'examen ; corps vide accepté (rétrocompat liste). */
  validerRapport(id: string, examen?: ValiderExamenDto) {
    return this.http.post<RapportDto>(`${this.baseUrl}/rapports/${id}/valider`, examen ?? {});
  }

  /** Validé → Transmis-admin : le superviseur signe et relaie le rapport à l'admin national. */
  signerRapport(id: string) {
    return this.http.post<RapportDto>(`${this.baseUrl}/rapports/${id}/signer`, {});
  }

  /** Transmis → Brouillon avec motif pour l'auteur (jamais muet). */
  renvoyerRapport(id: string, motif: string) {
    return this.http.post<RapportDto>(`${this.baseUrl}/rapports/${id}/renvoyer`, { motif });
  }

  /**
   * Crée un BROUILLON (auteur = JWT) ; commune/dept imposés par le périmètre côté serveur.
   * `contenuJson` = choix guidés du technicien (cases cochées, GPS…) ; le serveur en dérive
   * le texte professionnel (resumeAuto). On envoie une chaîne JSON déjà sérialisée.
   */
  creerRapport(payload: { titre: string; type?: string; commune?: string | null; departement?: string | null; pages?: number | null; contenuJson?: string | null; interventionId?: number | null }) {
    return this.http.post<RapportDto>(`${this.baseUrl}/rapports`, payload);
  }

  /** L'auteur transmet son brouillon → TRANSMIS (file de validation du superviseur). */
  transmettreRapport(id: string) {
    return this.http.post<RapportDto>(`${this.baseUrl}/rapports/${id}/transmettre`, {});
  }

  // ── Zones AEP — scopées à l'URD (serveur), activation = écriture gardée ──

  listZones(departementId?: string) {
    const options = departementId ? { params: new HttpParams().set('departementId', departementId) } : {};
    return this.http.get<ZoneDto[]>(`${this.baseUrl}/zones`, options);
  }

  /** Créer + activer une zone. Le serveur verrouille le département sur le token (403 si forgé). */
  activerZone(payload: { nom: string; commune: string; departementId: string; code?: string; geom?: string; populationCible?: number }) {
    return this.http.post<ZoneDto>(`${this.baseUrl}/zones/activer`, payload);
  }

  /** Activer une zone existante (à_deployer → active), dans le périmètre. */
  activerZoneExistante(id: string) {
    return this.http.post<ZoneDto>(`${this.baseUrl}/zones/${id}/activer`, {});
  }

  // ── Existing endpoints ────────────────────────────────────────────

  dashboard() {
    return this.http.get<any>(`${this.baseUrl}/dashboard`);
  }

  health() {
    return this.http.get<any>(`${this.baseUrl}/health`);
  }

  realtimePoints(pointIds?: string[]) {
    let params = new HttpParams();
    for (const id of pointIds ?? []) {
      params = params.append('pointIds', id);
    }
    return this.http.get<any[]>(`${this.baseUrl}/realtime/points`, { params });
  }

  ingestMeasurement(payload: {
    pointId: string;
    sensorId: string;
    type: string;
    value: number;
    unit: string;
    timestamp?: string;
  }) {
    return this.http.post<any>(`${this.baseUrl}/iot/measurements`, payload);
  }

  alerts(status?: 'ACTIVE' | 'ACK' | 'CLOSED', departementId?: string) {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (departementId) params = params.set('departementId', departementId);
    return this.http.get<any>(`${this.baseUrl}/alerts`, { params });
  }

  createAlert(payload: Record<string, unknown>) {
    return this.http.post<any>(`${this.baseUrl}/alerts`, payload);
  }

  ackAlert(id: number) {
    return this.http.post<any>(`${this.baseUrl}/alerts/${id}/ack`, {});
  }

  tickets(departementId?: string, kind?: 'ALERTE' | 'ORDRE') {
    let params = new HttpParams();
    if (departementId) params = params.set('departementId', departementId);
    if (kind) params = params.set('kind', kind);
    return this.http.get<any>(`${this.baseUrl}/tickets`, { params });
  }

  // ── Interventions (ordre de travail superviseur → technicien) ──
  // Contrat client des endpoints /api/tickets/* ; consommé par InterventionStore.

  creerIntervention(payload: CreateInterventionPayload) {
    return this.http.post<any>(`${this.baseUrl}/tickets/intervention`, payload);
  }
  envoyerIntervention(id: number) {
    return this.http.post<any>(`${this.baseUrl}/tickets/${id}/envoyer`, {});
  }
  accepterIntervention(id: number) {
    return this.http.post<any>(`${this.baseUrl}/tickets/${id}/accepter`, {});
  }
  refuserIntervention(id: number, motif?: string) {
    return this.http.post<any>(`${this.baseUrl}/tickets/${id}/refuser`, { motif: motif ?? null });
  }
  demarrerIntervention(id: number) {
    return this.http.post<any>(`${this.baseUrl}/tickets/${id}/demarrer`, {});
  }
  terminerIntervention(id: number) {
    return this.http.post<any>(`${this.baseUrl}/tickets/${id}/terminer`, {});
  }
  // ── Validation superviseur (fiche d'intervention, bloc K) ──
  validerIntervention(id: number, commentaire?: string) {
    return this.http.post<any>(`${this.baseUrl}/tickets/${id}/valider`, { commentaire: commentaire ?? null });
  }
  demanderCorrection(id: number, motif: string) {
    return this.http.post<any>(`${this.baseUrl}/tickets/${id}/corriger`, { motif });
  }
  cloturerIntervention(id: number) {
    return this.http.post<any>(`${this.baseUrl}/tickets/${id}/cloturer`, {});
  }
  tachesIntervention(id: number) {
    return this.http.get<InterventionTacheDto[]>(`${this.baseUrl}/tickets/${id}/taches`);
  }
  cocherTacheIntervention(id: number, tacheId: number, statut: 'A_FAIRE' | 'FAIT' | 'NON_APPLICABLE', commentaire?: string) {
    return this.http.patch<InterventionTacheDto>(`${this.baseUrl}/tickets/${id}/taches/${tacheId}`,
      { statut, commentaire: commentaire ?? null });
  }
  affecterTechnicien(id: number, personneUsername: string, role: 'PRINCIPAL' | 'APPUI' = 'PRINCIPAL') {
    return this.http.post<AffectationDto>(`${this.baseUrl}/tickets/${id}/affecter`, { personneUsername, role });
  }
  libererTechnicien(id: number, personneUsername: string) {
    return this.http.post<AffectationDto>(`${this.baseUrl}/tickets/${id}/liberer`, { personneUsername });
  }
  affectationsDe(id: number) {
    return this.http.get<AffectationDto[]>(`${this.baseUrl}/tickets/${id}/affectations`);
  }
  affectationsOuvertes() {
    return this.http.get<AffectationDto[]>(`${this.baseUrl}/tickets/affectations/ouvertes`);
  }
  /** Upload multipart d'une preuve terrain (type = AVANT|PENDANT|APRES|ANOMALIE|SIGNATURE). */
  ajouterPhotoIntervention(id: number, file: File, type: string, lat?: number, lon?: number, commentaire?: string) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    if (commentaire) fd.append('commentaire', commentaire);
    if (lat != null) fd.append('lat', String(lat));
    if (lon != null) fd.append('lon', String(lon));
    return this.http.post<PhotoDto>(`${this.baseUrl}/tickets/${id}/photos`, fd);
  }
  photosIntervention(id: number) {
    return this.http.get<PhotoDto[]>(`${this.baseUrl}/tickets/${id}/photos`);
  }
  photoContenuUrl(id: number, photoId: number): string {
    return `${this.baseUrl}/tickets/${id}/photos/${photoId}/contenu`;
  }
  /** Octets d'une photo en blob (l'intercepteur ajoute le Bearer → utilisable via createObjectURL). */
  photoContenu(id: number, photoId: number) {
    return this.http.get(`${this.baseUrl}/tickets/${id}/photos/${photoId}/contenu`, { responseType: 'blob' });
  }

  /** Capteurs scopés par le serveur depuis le JWT (commune pour un TEPAC). */
  /** Vue dérivée (carte/accueil) — points scopés + dernière mesure + alerte. */
  capteurs(departementId?: string) {
    const options = departementId ? { params: new HttpParams().set('departementId', departementId) } : {};
    return this.http.get<CapteurDeriveDto[]>(`${this.baseUrl}/capteurs`, options);
  }

  // ── Registre des capteurs IoT (cycle de validation) — /api/iot/capteurs ──

  listCapteurs(departementId?: string) {
    const options = departementId ? { params: new HttpParams().set('departementId', departementId) } : {};
    return this.http.get<CapteurDto[]>(`${this.baseUrl}/iot/capteurs`, options);
  }

  /** TEPAC : déclare/installe un capteur (dept+commune imposés par le token → EN_ATTENTE). */
  declarerCapteur(payload: {
    id?: string; code?: string; nom: string; type: string;
    department?: string; commune?: string | null;
    ouvrageId?: string | null; ouvrageNom?: string | null;
    deviceId?: string | null; mqttTopic?: string | null; unit?: string | null;
    lat?: number | null; lon?: number | null; createdBy?: string;
  }) {
    return this.http.post<CapteurDto>(`${this.baseUrl}/iot/capteurs`, payload);
  }

  /** Superviseur d'URD : valide une déclaration → capteur officiellement actif. */
  validerCapteur(id: string) {
    return this.http.patch<CapteurDto>(`${this.baseUrl}/iot/capteurs/${id}/valider`, {});
  }

  /** Superviseur d'URD : rejette une déclaration (motif obligatoire). */
  rejeterCapteur(id: string, motif: string) {
    return this.http.patch<CapteurDto>(`${this.baseUrl}/iot/capteurs/${id}/rejeter`, { motif });
  }

  /** Communes du département du JWT (dropdowns scopés ; un superviseur ne voit que les siennes). */
  communes(departementId?: string) {
    const options = departementId ? { params: new HttpParams().set('departementId', departementId) } : {};
    return this.http.get<{ id: string; nom: string; arrondissement: string | null; departementId: string; aUnTepac: boolean }[]>(
      `${this.baseUrl}/communes`, options);
  }

  /** Notifications de l'utilisateur connecté (clé d'auth du JWT). luSeulement → seulement non lues. */
  notifications(luSeulement = false) {
    const options = luSeulement ? { params: new HttpParams().set('lu', 'false') } : {};
    return this.http.get<any[]>(`${this.baseUrl}/notifications`, options);
  }
  marquerNotifLue(id: number) { return this.http.post<any>(`${this.baseUrl}/notifications/${id}/lu`, {}); }
  toutMarquerNotifLu()        { return this.http.post<void>(`${this.baseUrl}/notifications/tout-lu`, {}); }

  createTicket(alertId: number, assignee: string) {
    return this.http.post<any>(`${this.baseUrl}/tickets`, { alertId, assignee });
  }

  advanceTicket(id: number) {
    return this.http.post<any>(`${this.baseUrl}/tickets/${id}/advance`, {});
  }

  assignTicket(id: number, assignee: string) {
    return this.http.post<any>(`${this.baseUrl}/tickets/${id}/assign`, { assignee });
  }

  history(pointId: string, type: string, from: string, to: string) {
    return this.http.get<any>(`${this.baseUrl}/history/points/${pointId}`, {
      params: new HttpParams().set('type', type).set('from', from).set('to', to)
    });
  }

  referenceCodeList(listName: string) {
    return this.http.get<any[]>(`${this.baseUrl}/reference/codelists/${listName}`);
  }

  referencePoints() {
    return this.http.get<any[]>(`${this.baseUrl}/reference/points`);
  }

  upsertReferencePoint(
    id: string,
    payload: {
      name?: string | null;
      type?: string | null;
      territory?: string | null;
      lon?: number | null;
      lat?: number | null;
      description?: string | null;
      active?: boolean | null;
    }
  ) {
    return this.http.put<any>(`${this.baseUrl}/reference/points/${id}`, payload);
  }

  deleteReferencePoint(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/reference/points/${id}`);
  }

  referenceThresholds() {
    return this.http.get<any[]>(`${this.baseUrl}/reference/thresholds`);
  }

  upsertThreshold(type: string, payload: { minWarn?: number | null; minCrit?: number | null }) {
    return this.http.put<any>(`${this.baseUrl}/reference/thresholds/${type}`, payload);
  }

  upsertCodeItem(
    listName: string,
    code: string,
    payload: {
      labelFr?: string | null;
      labelHt?: string | null;
      labelEn?: string | null;
      color?: string | null;
      sortOrder?: number | null;
      active?: boolean | null;
    }
  ) {
    return this.http.put<any>(`${this.baseUrl}/reference/codelists/${listName}/${code}`, payload);
  }

  deleteCodeItem(listName: string, code: string) {
    return this.http.delete<void>(`${this.baseUrl}/reference/codelists/${listName}/${code}`);
  }

  processDefinitions() {
    return this.http.get<any[]>(`${this.baseUrl}/process-definitions`);
  }

  startProcess(definitionKey: string, variables?: Record<string, unknown>) {
    return this.http.post<any>(`${this.baseUrl}/process-instances/${definitionKey}/start`, variables ?? {});
  }

  tasks(processInstanceId: string) {
    return this.http.get<any[]>(`${this.baseUrl}/tasks`, {
      params: new HttpParams().set('processInstanceId', processInstanceId)
    });
  }

  completeTask(taskId: string, variables?: Record<string, unknown>) {
    return this.http.post<void>(`${this.baseUrl}/tasks/${taskId}/complete`, variables ?? {});
  }
}
