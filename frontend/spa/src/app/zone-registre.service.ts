import { Injectable, signal } from '@angular/core';
import { ZoneFiche, DepartmentNode, ZoneStatus } from './zone.models';
import { DEPT_COMMUNES, } from './haiti-departments.data';
import { ZONE_FICHES, ZONE_DEPARTMENTS } from './zone-seed.data';
import { DEPT_CENTERS } from './haiti-geo.service';

const KEY_V2 = 'gestidlo_zone_state_v2';
const KEY_V1 = 'gestidlo_territoire_v1'; // ancien format — fallback

interface StoredState {
  version: 2;
  userFiches: ZoneFiche[];
  communeLinks: Array<{ deptId: string; communeId: string; ficheId: string }>;
}

@Injectable({ providedIn: 'root' })
export class ZoneRegistreService {
  private _fiches: ZoneFiche[] = ZONE_FICHES;
  private _departments: DepartmentNode[] = ZONE_DEPARTMENTS;

  private readonly _v = signal(0);
  readonly version = this._v.asReadonly();
  bump(): void { this._v.update(n => n + 1); }

  constructor() {
    this._loadFromStorage();
    this.bump();
  }

  /**
   * Enregistre les tableaux partagés et recharge immédiatement les données
   * persistées en localStorage. À appeler depuis le constructeur de
   * TerritoireComponent (qui est propriétaire des tableaux statiques).
   */
  register(fiches: ZoneFiche[], departments: DepartmentNode[]): void {
    this._fiches      = fiches;
    this._departments = departments;
    this._loadFromStorage();
    this.bump();
  }

  getZone(id: string): ZoneFiche | undefined {
    return this._fiches?.find(f => f.id === id);
  }

  getAllZones(): ZoneFiche[] { return this._fiches; }

  getZonesByDept(dept: string): ZoneFiche[] {
    return (this._fiches).filter(z => z.dept === dept);
  }

  getZonesByCommune(commune: string): ZoneFiche[] {
    return (this._fiches).filter(z => z.commune === commune);
  }

  getCommunesForDept(deptNom: string): string[] {
    // Try live departments first, fall back to static reference data
    const dept = this._departments?.find(d => d.nom === deptNom);
    if (dept) return dept.communes.map(c => c.nom);
    return DEPT_COMMUNES[deptNom] ?? [];
  }

  getCommuneLatLon(deptNom: string, communeNom: string): [number, number] | null {
    const dept = this._departments?.find(d => d.nom === deptNom);
    const comm = dept?.communes.find(c => c.nom === communeNom);
    return comm ? [comm.lat, comm.lon] : null;
  }

  activerZone(nom: string, dept: string, commune: string, responsable?: string): ZoneFiche {
    const clean = (s: string) =>
      s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z]/g, '');
    const d = clean(dept).substring(0, 5);
    const c = clean(commune).substring(0, 3);
    const seq = String(this._fiches.length + 1).padStart(2, '0');
    const code = `TER-${d}-${c}-S${seq}`;
    const id   = 'fz-' + code.toLowerCase().replace(/[^a-z0-9]/g, '-');

    const deptNode = this._departments?.find(dn => dn.nom === dept);
    const commNode = deptNode?.communes.find(cn => cn.nom === commune);
    const lat = commNode?.lat ?? DEPT_CENTERS[dept]?.[0] ?? 18.5;
    const lon = commNode?.lon ?? DEPT_CENTERS[dept]?.[1] ?? -72.3;

    const fiche: ZoneFiche = {
      id, code, codeIhsi: code,
      nom: nom.trim(), dept, commune,
      superficie: 0, population: 0, foyers: 0, densiteHabKm2: 0,
      coverageAep: 0, continuiteService: 0, accessibilite: 'Difficile · chemin', localites: 0,
      activeLe: new Date().toLocaleDateString('fr-FR'),
      resources: 0, infras: 0, capteurs: 0, alertes: 0,
      responsable: responsable || undefined,
      status: 'deploying',
      journal: [{
        date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
        label: 'Zone enregistrée dans GEstiDlo',
        author: 'Admin',
        type: 'activate',
      }],
      lat, lon,
    };

    this._fiches.push(fiche);
    if (commNode) { commNode.active = true; commNode.ficheId = id; }
    this.persistAll();
    this.bump();
    return fiche;
  }

  updateZoneStatus(id: string, status: ZoneStatus): void {
    const f = this.getZone(id);
    if (!f) return;
    f.status = status;
    this.persistAll();
    this.bump();
  }

  /**
   * Archive une zone supervisée. Une zone archivée reste lisible et toutes ses
   * liaisons restent intactes — elle n'est jamais supprimée.
   */
  archiveZone(id: string): void {
    const f = this.getZone(id);
    if (!f || f.status === 'archivee') return;
    f.status = 'archivee';
    f.journal.unshift({
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
      label: 'Zone archivée — historique conservé, liaisons intactes',
      author: 'Admin',
      type: 'update',
    });
    this.persistAll();
    this.bump();
  }

  /** Retourne false si la zone est supervisée ou archivée (protection permanence). */
  canDelete(id: string): boolean {
    const status = this.getZone(id)?.status;
    return status !== 'supervised' && status !== 'archivee' && status !== undefined;
  }

  addJournal(id: string, label: string, author = 'Admin'): void {
    const f = this.getZone(id);
    if (!f) return;
    f.journal.unshift({
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
      label, author, type: 'update',
    });
    this.persistAll();
    this.bump();
  }

  updateZoneField<K extends keyof ZoneFiche>(id: string, field: K, value: ZoneFiche[K]): void {
    const f = this.getZone(id);
    if (!f) return;
    (f as any)[field] = value;
    this.persistAll();
    this.bump();
  }

  /**
   * Sauvegarde tout en localStorage.
   * Appelée après chaque mutation : création de zone, changement de statut, journal.
   */
  persistAll(): void {
    try {
      // Seules les fiches "user" (avec status défini) sont persistées
      const userFiches = this._fiches.filter(f => f.status !== undefined);

      const communeLinks: StoredState['communeLinks'] = [];
      for (const dept of this._departments) {
        for (const comm of dept.communes) {
          if (comm.active && comm.ficheId) {
            communeLinks.push({ deptId: dept.id, communeId: comm.id, ficheId: comm.ficheId });
          }
        }
      }

      const state: StoredState = { version: 2, userFiches, communeLinks };
      localStorage.setItem(KEY_V2, JSON.stringify(state));
    } catch { /* quota ou mode privé */ }
  }

  private _loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(KEY_V2);
      if (raw) {
        const state: StoredState = JSON.parse(raw);
        if (state.version === 2) {
          // Fiches utilisateur : push si absentes du tableau statique
          for (const f of (state.userFiches ?? [])) {
            if (!this._fiches.find(x => x.id === f.id)) {
              this._fiches.push(f);
            } else {
              const existing = this._fiches.find(x => x.id === f.id)!;
              existing.status    = f.status;
              existing.journal   = f.journal;
              // Restaurer les sorties du recensement
              if (f.superficie)  existing.superficie  = f.superficie;
              if (f.foyers)      existing.foyers      = f.foyers;
              if (f.population)  existing.population  = f.population;
              if (f.qmj)         existing.qmj         = f.qmj;
              if (f.qpj)         existing.qpj         = f.qpj;
              if (f.horizonRef)  existing.horizonRef  = f.horizonRef;
              if (f.snapshots)   existing.snapshots   = f.snapshots;
            }
          }
          // Liens commune → fiche
          for (const link of (state.communeLinks ?? [])) {
            const dept = this._departments.find(d => d.id === link.deptId);
            const comm = dept?.communes.find(c => c.id === link.communeId);
            if (comm) { comm.active = true; comm.ficheId = link.ficheId; }
          }
          return;
        }
      }

      // Fallback v1 : seuls les IDs de communes actives
      const old = localStorage.getItem(KEY_V1);
      if (old) {
        const ids: string[] = JSON.parse(old);
        for (const d of this._departments) {
          for (const c of d.communes) {
            if (ids.includes(c.id)) c.active = true;
          }
        }
      }
    } catch { /* ignore */ }
  }
}
