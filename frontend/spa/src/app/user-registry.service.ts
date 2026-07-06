import { Injectable, signal, computed } from '@angular/core';
import { catchError, of } from 'rxjs';
import { BffApiService, UserProfileDto } from './api/bff-api.service';

export type { UserProfileDto };

const ROLE_LABELS: Record<string, string> = {
  superviseur_urd:      'Superviseur URD',
  superviseur_regional: 'Superviseur régional',
  admin_orepa:          'Admin OREPA',
  'Admin OREPA':        'Admin OREPA',
  'Superviseur régional': 'Superviseur régional',
  'Superviseur URD':    'Superviseur URD',
};

const ROLE_CLS: Record<string, string> = {
  superviseur_urd:        'blue',
  'Superviseur URD':      'blue',
  superviseur_regional:   'green',
  'Superviseur régional': 'green',
  admin_orepa:            'violet',
  'Admin OREPA':          'violet',
};

@Injectable({ providedIn: 'root' })
export class UserRegistryService {
  private readonly _list = signal<UserProfileDto[]>([]);

  readonly list    = this._list.asReadonly();
  readonly count   = computed(() => this._list().length);

  constructor(private readonly bff: BffApiService) {
    this._loadFromApi();
  }

  /** Recharge la liste depuis l'API (appel idempotent, appelable après création). */
  reload(): void { this._loadFromApi(); }

  /** Crée un utilisateur via l'API et met à jour le cache local immédiatement. */
  createUser(payload: Parameters<BffApiService['createUser']>[0]) {
    return this.bff.createUser(payload).pipe(
      catchError(err => { throw err; })
    );
  }

  addToCache(profile: UserProfileDto): void {
    this._list.update(l => [...l, profile]);
  }

  isUsernameTaken(username: string): boolean {
    return this._list().some(u => u.username.toLowerCase() === username.toLowerCase());
  }

  isEmailTaken(email: string): boolean {
    if (!email.trim()) return false;
    return this._list().some(u => !!u.email && u.email.toLowerCase() === email.toLowerCase().trim());
  }

  isPhoneTaken(phone: string): boolean {
    if (!phone.trim()) return false;
    return this._list().some(u => !!u.telephone && u.telephone === phone.trim());
  }

  /** Mappe un profil API vers le format d'affichage utilisé par UtilisateursComponent. */
  toDisplayRow(p: UserProfileDto): DisplayUser {
    const roleCls = ROLE_CLS[p.role] ?? 'blue';
    return {
      id:          p.username,
      initiales:   p.initiales || initiales(p.nom),
      nom:         p.nom,
      email:       p.email,
      phone:       p.telephone || undefined,
      role:        ROLE_LABELS[p.role] ?? p.role,
      roleCls,
      zone:        p.dept || p.orepa || '—',
      institution: p.urdId ? `URD ${p.dept}` : (p.orepa || '—'),
      instCls:     roleCls,
      statut:      'Actif · à valider',
      statutCls:   'amber',
      online:      false,
    };
  }

  private _loadFromApi(): void {
    this.bff.listUsers().pipe(
      catchError(() => of([])) // dégradé gracieux si backend offline
    ).subscribe(profiles => this._list.set(profiles));
  }
}

export interface DisplayUser {
  id: string; initiales: string; nom: string; email: string; phone?: string;
  role: string; roleCls: string; zone: string;
  institution: string; instCls: string; statut: string; statutCls: string; online: boolean;
}

function initiales(nom: string): string {
  return (nom ?? '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
