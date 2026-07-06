import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type InstitutionStatus = 'active' | 'inactive' | 'archive';
export type PersonStatus = 'actif' | 'mission' | 'indisponible' | 'suspendu';

export interface Institution {
  id: string; name: string; type: string; level: string;
  department: string; communes: string[]; sections: number;
  primaryContact: string; phone: string; email: string;
  status: InstitutionStatus; resources: number; infrastructures: number;
  serviceZones: number; openIncidents: number; pendingReports: number;
  responsables: number; techniciens: number; color: string;
  lat: number; lng: number; radius: number;
}

export interface GovPerson {
  id: string; name: string; institution: string; fonction: string;
  territory: string; level: string; status: PersonStatus; email: string; phone: string;
}

export interface Technicien {
  id: string; name: string; institution: string; specialty: string;
  zone: string; level: string; status: PersonStatus; email: string;
}

const INITIAL_INSTITUTIONS: Institution[] = [
  {
    id: 'inst-001', name: 'DINEPA Ouest', type: 'Autorité régionale', level: 'Départemental',
    department: 'Ouest', communes: ['Léogâne', 'Carrefour', 'Tabarre'], sections: 18,
    primaryContact: 'Jean Michel', phone: '+509 34 12 45 67', email: 'ouest@dinepa.ht',
    status: 'active', resources: 24, infrastructures: 86, serviceZones: 18, openIncidents: 7, pendingReports: 3,
    responsables: 4, techniciens: 12, color: '#2563eb', lat: 18.50, lng: -72.68, radius: 14000,
  },
  {
    id: 'inst-002', name: 'Mairie de Léogâne', type: 'Autorité locale', level: 'Communal',
    department: 'Ouest', communes: ['Léogâne'], sections: 6,
    primaryContact: 'Marie Pierre', phone: '+509 28 45 67 89', email: 'mairie@leogane.ht',
    status: 'active', resources: 8, infrastructures: 22, serviceZones: 6, openIncidents: 2, pendingReports: 1,
    responsables: 2, techniciens: 4, color: '#16a34a', lat: 18.51, lng: -72.63, radius: 6000,
  },
  {
    id: 'inst-003', name: 'OREPA Ouest', type: 'Direction régionale', level: 'Départemental',
    department: 'Ouest', communes: ['Carrefour', 'Pétion-Ville', 'Delmas'], sections: 12,
    primaryContact: 'Josué Saint-Vil', phone: '+509 36 78 90 12', email: 'orepa.ouest@dinepa.ht',
    status: 'active', resources: 18, infrastructures: 64, serviceZones: 14, openIncidents: 4, pendingReports: 2,
    responsables: 3, techniciens: 8, color: '#0d9488', lat: 18.55, lng: -72.42, radius: 13000,
  },
  {
    id: 'inst-004', name: 'DINEPA Sud', type: 'Autorité régionale', level: 'Départemental',
    department: 'Sud', communes: ['Jacmel', 'Cayes'], sections: 10,
    primaryContact: 'Paul Léandre', phone: '+509 22 34 56 78', email: 'sud@dinepa.ht',
    status: 'active', resources: 14, infrastructures: 40, serviceZones: 10, openIncidents: 3, pendingReports: 1,
    responsables: 3, techniciens: 6, color: '#f97316', lat: 18.23, lng: -72.53, radius: 12000,
  },
  {
    id: 'inst-005', name: 'Lab. DINEPA', type: 'Laboratoire', level: 'National',
    department: 'National', communes: ['Port-au-Prince'], sections: 0,
    primaryContact: 'Dr. Joseph Pierre', phone: '+509 30 45 67 89', email: 'lab@dinepa.ht',
    status: 'active', resources: 0, infrastructures: 2, serviceZones: 0, openIncidents: 0, pendingReports: 4,
    responsables: 2, techniciens: 3, color: '#9333ea', lat: 18.54, lng: -72.34, radius: 4000,
  },
  {
    id: 'inst-006', name: 'Partenaire / ONG', type: 'Partenaire', level: 'Multi-zone',
    department: 'Ouest / Sud', communes: ['Léogâne', 'Jacmel'], sections: 4,
    primaryContact: 'Claire Dubois', phone: '+509 48 90 12 34', email: 'contact@ong.ht',
    status: 'active', resources: 6, infrastructures: 12, serviceZones: 4, openIncidents: 1, pendingReports: 0,
    responsables: 1, techniciens: 2, color: '#94a3b8', lat: 18.38, lng: -72.72, radius: 5000,
  },
];

const INITIAL_RESPONSABLES: GovPerson[] = [
  { id: 'r-001', name: 'Jean Michel', institution: 'DINEPA Ouest', fonction: 'Responsable régional', territory: 'Département : Ouest', level: 'Départemental', status: 'actif', email: 'jean.michel@dinepa.ht', phone: '+509 34 12 45 67' },
  { id: 'r-002', name: 'Marie Pierre', institution: 'Mairie de Léogâne', fonction: 'Responsable communal', territory: 'Commune : Léogâne', level: 'Communal', status: 'actif', email: 'marie.pierre@mairie.ht', phone: '+509 28 45 67 89' },
  { id: 'r-003', name: 'Marc Étienne', institution: 'DINEPA Ouest', fonction: 'Superviseur technique', territory: 'Sections : 6 sections', level: 'Section', status: 'actif', email: 'marc.etienne@dinepa.ht', phone: '+509 34 56 78 90' },
  { id: 'r-004', name: 'Josué Saint-Vil', institution: 'OREPA Ouest', fonction: 'Coordinateur terrain', territory: 'Communes : 3 communes', level: 'Communal', status: 'mission', email: 'josue@orepa.ht', phone: '+509 36 78 90 12' },
  { id: 'r-005', name: 'Dr. Joseph Pierre', institution: 'Lab. DINEPA', fonction: 'Responsable qualité', territory: 'Département : Ouest', level: 'Départemental', status: 'actif', email: 'joseph.pierre@lab.dinepa.ht', phone: '+509 30 45 67 89' },
  { id: 'r-006', name: 'Claire Dubois', institution: 'Partenaire / ONG', fonction: 'Coordinatrice partenaire', territory: 'Léogâne / Jacmel', level: 'Multi-zone', status: 'actif', email: 'claire@ong.ht', phone: '+509 48 90 12 34' },
  { id: 'r-007', name: 'Paul Léandre', institution: 'DINEPA Sud', fonction: 'Responsable régional', territory: 'Département : Sud', level: 'Départemental', status: 'indisponible', email: 'paul.leandre@dinepa.ht', phone: '+509 22 34 56 78' },
];

const INITIAL_TECHNICIENS: Technicien[] = [
  { id: 't-001', name: 'Frantz Joseph',       institution: 'DINEPA Ouest',     specialty: 'Réservoir / Pompe',      zone: 'Léogâne',       level: 'Section', status: 'actif',    email: 'frantz@dinepa.ht' },
  { id: 't-002', name: 'Gérald Baptiste',     institution: 'DINEPA Ouest',     specialty: 'Capteur IoT',            zone: 'Dessources',    level: 'Local',   status: 'mission',  email: 'gerald@dinepa.ht' },
  { id: 't-003', name: 'Anne-Marie Toussaint',institution: 'Mairie de Léogâne',specialty: "Qualité de l'eau",       zone: 'Léogâne Centre',level: 'Local',   status: 'actif',    email: 'annemarie@mairie.ht' },
  { id: 't-004', name: 'Remy Delice',         institution: 'OREPA Ouest',      specialty: 'Conduite / Pression',    zone: 'Carrefour',     level: 'Section', status: 'actif',    email: 'remy@orepa.ht' },
  { id: 't-005', name: 'Stevenson Paul',      institution: 'DINEPA Sud',       specialty: 'Maintenance électrique', zone: 'Jacmel',        level: 'Local',   status: 'suspendu', email: 'stevenson@dinepa.ht' },
];

@Injectable({ providedIn: 'root' })
export class GovernanceStore {
  private _institutions$ = new BehaviorSubject<Institution[]>(INITIAL_INSTITUTIONS);
  private _responsables$ = new BehaviorSubject<GovPerson[]>(INITIAL_RESPONSABLES);
  private _techniciens$  = new BehaviorSubject<Technicien[]>(INITIAL_TECHNICIENS);

  readonly institutions$ = this._institutions$.asObservable();
  readonly responsables$ = this._responsables$.asObservable();
  readonly techniciens$  = this._techniciens$.asObservable();

  get institutions(): Institution[] { return this._institutions$.value; }
  get responsables(): GovPerson[]  { return this._responsables$.value; }
  get techniciens(): Technicien[]  { return this._techniciens$.value; }

  techniciensForInstitution(institutionName: string): Technicien[] {
    if (!institutionName) return this.techniciens.filter(t => t.status !== 'suspendu');
    return this.techniciens.filter(t => t.institution === institutionName && t.status !== 'suspendu');
  }

  /**
   * Périmètre territorial des techniciens (fonction centrale, pas de patch dispersé) :
   * ADMIN = tous, SUPERVISEUR_URD = son département, TEPAC = sa commune. Élimine la fuite
   * « un TEPAC Jacmel voit Frantz Joseph · Léogâne » dans un formulaire opérationnel.
   * NB : la source reste le mock INITIAL_TECHNICIENS (pas de champ commune/dept dessus) —
   * commune dérivée de {@code zone}, département de {@code institution} ; à terme, remplacer
   * par le registre réel des acteurs/utilisateurs scopé serveur.
   */
  techniciensForScope(scope: { roles?: string[]; dept?: string | null; commune?: string | null }): Technicien[] {
    const actifs = this.techniciens.filter(t => t.status !== 'suspendu');
    const roles = scope.roles ?? [];
    if (roles.includes('ADMIN')) return actifs;
    if (roles.includes('TEPAC')) {
      const c = (scope.commune ?? '').trim().toLowerCase();
      return c ? actifs.filter(t => (t.zone ?? '').toLowerCase().startsWith(c)) : [];
    }
    if (roles.includes('SUPERVISEUR_URD')) {
      const d = (scope.dept ?? '').trim().toLowerCase();
      return d ? actifs.filter(t => this.deptOf(t).toLowerCase() === d) : [];
    }
    return [];
  }

  /** Département d'un technicien, dérivé de son institution (mock). */
  private deptOf(t: Technicien): string {
    return this.institutions.find(i => i.name === t.institution)?.department ?? '';
  }

  addInstitution(inst: Institution): void {
    this._institutions$.next([inst, ...this._institutions$.value]);
  }
  updateInstitution(inst: Institution): void {
    this._institutions$.next(this._institutions$.value.map(x => x.id === inst.id ? inst : x));
  }

  addResponsable(p: GovPerson): void {
    this._responsables$.next([p, ...this._responsables$.value]);
  }

  addTechnicien(t: Technicien): void {
    this._techniciens$.next([t, ...this._techniciens$.value]);
  }
  updateTechnicien(t: Technicien): void {
    this._techniciens$.next(this._techniciens$.value.map(x => x.id === t.id ? t : x));
  }
}
