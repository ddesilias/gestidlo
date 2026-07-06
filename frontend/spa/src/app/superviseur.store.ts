import { Injectable, signal, computed } from '@angular/core';

export interface SuperviseurData {
  id: string;
  initiales: string;
  nom: string;
  email: string;
  phone?: string;
  username: string;
  role: string;
  roleCls: string;
  zone: string;
  institution: string;
  instCls: string;
  statut: string;
  statutCls: string;
  online: boolean;
  createdAt: string;
}

const KEY = 'gestidlo_superviseurs_v1';

@Injectable({ providedIn: 'root' })
export class SuperviseurStore {
  private readonly _list = signal<SuperviseurData[]>(this._load());

  readonly list  = this._list.asReadonly();
  readonly count = computed(() => this._list().length);

  add(data: SuperviseurData): void {
    this._list.update(l => [...l, data]);
    this._persist();
  }

  isUsernameTaken(username: string): boolean {
    return this._list().some(s => s.username.toLowerCase() === username.toLowerCase());
  }

  isEmailTaken(email: string): boolean {
    if (!email.trim()) return false;
    return this._list().some(s => s.email.toLowerCase() === email.toLowerCase().trim());
  }

  isPhoneTaken(phone: string): boolean {
    if (!phone.trim()) return false;
    return this._list().some(s => !!s.phone && s.phone === phone.trim());
  }

  private _load(): SuperviseurData[] {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as SuperviseurData[]) : [];
    } catch { return []; }
  }

  private _persist(): void {
    try { localStorage.setItem(KEY, JSON.stringify(this._list())); } catch { /* quota */ }
  }
}
