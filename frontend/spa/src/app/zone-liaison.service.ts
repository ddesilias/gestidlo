import { Injectable, signal } from '@angular/core';
import {
  ZoneInfrastructureLien, ZoneRessourceLien, LienRole,
  ZoneActeurLien, ZoneUtilisateurLien, LienActeurRole, LienUserRole,
} from './zone.models';

const KEY = 'gestidlo_liaison_v1';

interface StoredState {
  liens:          ZoneInfrastructureLien[];
  liensRessource: ZoneRessourceLien[];
  liensActeur:    ZoneActeurLien[];
  liensUser:      ZoneUtilisateurLien[];
}

@Injectable({ providedIn: 'root' })
export class ZoneLiaisonService {
  private readonly _liens          = signal<ZoneInfrastructureLien[]>([]);
  private readonly _liensRessource = signal<ZoneRessourceLien[]>([]);
  private readonly _liensActeur    = signal<ZoneActeurLien[]>([]);
  private readonly _liensUser      = signal<ZoneUtilisateurLien[]>([]);
  private readonly _v              = signal(0);

  readonly liens          = this._liens.asReadonly();
  readonly liensRessource = this._liensRessource.asReadonly();
  readonly liensActeur    = this._liensActeur.asReadonly();
  readonly liensUser      = this._liensUser.asReadonly();
  readonly version        = this._v.asReadonly();

  constructor() { this._load(); }

  // ── Persistance ──────────────────────────────────────────────────

  private _load(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const state: StoredState = JSON.parse(raw);
      this._liens.set(state.liens ?? []);
      this._liensRessource.set(state.liensRessource ?? []);
      this._liensActeur.set(state.liensActeur ?? []);
      this._liensUser.set(state.liensUser ?? []);
    } catch { /* quota ou mode privé */ }
  }

  private _persist(): void {
    try {
      const state: StoredState = {
        liens:          this._liens(),
        liensRessource: this._liensRessource(),
        liensActeur:    this._liensActeur(),
        liensUser:      this._liensUser(),
      };
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
    this._v.update(n => n + 1);
  }

  private now(): string {
    return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── zone_infrastructure ───────────────────────────────────────────

  isAttached(zoneId: string, infraId: string): boolean {
    return this._liens().some(l => l.zoneId === zoneId && l.infrastructureId === infraId && l.statut === 'actif');
  }

  getLiensForZone(zoneId: string): ZoneInfrastructureLien[] {
    return this._liens().filter(l => l.zoneId === zoneId && l.statut === 'actif');
  }

  getLiensForInfra(infraId: string): ZoneInfrastructureLien[] {
    return this._liens().filter(l => l.infrastructureId === infraId && l.statut === 'actif');
  }

  attach(zoneId: string, infraId: string, role: LienRole, noeudAncrageId?: string, quotePartDebit?: number): void {
    if (this.isAttached(zoneId, infraId)) return;
    const lien: ZoneInfrastructureLien = {
      id: `lzn-${Date.now()}`,
      zoneId, infrastructureId: infraId, role,
      noeudAncrageId: noeudAncrageId || undefined, quotePartDebit,
      dateLien: this.now(), statut: 'actif',
    };
    this._liens.update(ls => [...ls, lien]);
    this._persist();
  }

  setAnchor(lienId: string, noeudAncrageId: string): void {
    this._liens.update(ls => ls.map(l => l.id === lienId ? { ...l, noeudAncrageId } : l));
    this._persist();
  }

  setQuotePart(lienId: string, pct: number): void {
    this._liens.update(ls => ls.map(l => l.id === lienId ? { ...l, quotePartDebit: pct } : l));
    this._persist();
  }

  detach(lienId: string): void {
    this._liens.update(ls => ls.filter(l => l.id !== lienId));
    this._persist();
  }

  // ── zone_ressource ────────────────────────────────────────────────

  getLiensRessourceForZone(zoneId: string): ZoneRessourceLien[] {
    return this._liensRessource().filter(l => l.zoneId === zoneId);
  }

  attachRessource(zoneId: string, ressourceId: string): void {
    if (this._liensRessource().some(l => l.zoneId === zoneId && l.ressourceId === ressourceId)) return;
    this._liensRessource.update(ls => [...ls, { zoneId, ressourceId, dateLien: this.now() }]);
    this._persist();
  }

  detachRessource(zoneId: string, ressourceId: string): void {
    this._liensRessource.update(ls => ls.filter(l => !(l.zoneId === zoneId && l.ressourceId === ressourceId)));
    this._persist();
  }

  // ── zone_acteur ───────────────────────────────────────────────────

  getLiensActeurForZone(zoneId: string): ZoneActeurLien[] {
    return this._liensActeur().filter(l => l.zoneId === zoneId && l.statut === 'actif');
  }

  getLiensActeurForInst(institutionId: string): ZoneActeurLien[] {
    return this._liensActeur().filter(l => l.institutionId === institutionId && l.statut === 'actif');
  }

  isActeurAttached(zoneId: string, institutionId: string): boolean {
    return this._liensActeur().some(l => l.zoneId === zoneId && l.institutionId === institutionId && l.statut === 'actif');
  }

  attachActeur(zoneId: string, institutionId: string, role: LienActeurRole): void {
    if (this.isActeurAttached(zoneId, institutionId)) return;
    const lien: ZoneActeurLien = {
      id: `lact-${Date.now()}`,
      zoneId, institutionId, role,
      dateLien: this.now(), statut: 'actif',
    };
    this._liensActeur.update(ls => [...ls, lien]);
    this._persist();
  }

  detachActeur(lienId: string): void {
    this._liensActeur.update(ls => ls.filter(l => l.id !== lienId));
    this._persist();
  }

  // ── zone_utilisateur ──────────────────────────────────────────────

  getLiensUserForZone(zoneId: string): ZoneUtilisateurLien[] {
    return this._liensUser().filter(l => l.zoneId === zoneId);
  }

  getLiensUserForUser(userId: string): ZoneUtilisateurLien[] {
    return this._liensUser().filter(l => l.userId === userId);
  }

  attachUser(zoneId: string, userId: string, role: LienUserRole, perimetreVisible: 'zone' | 'commune' | 'national' = 'zone'): void {
    if (this._liensUser().some(l => l.zoneId === zoneId && l.userId === userId)) return;
    const lien: ZoneUtilisateurLien = {
      id: `lusr-${Date.now()}`,
      zoneId, userId, role, perimetreVisible,
      dateLien: this.now(),
    };
    this._liensUser.update(ls => [...ls, lien]);
    this._persist();
  }

  detachUser(lienId: string): void {
    this._liensUser.update(ls => ls.filter(l => l.id !== lienId));
    this._persist();
  }
}
