import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GovShellComponent } from '../shared/gov-shell.component';

interface AuditEvent {
  id: string; horodatage: string; utilisateur: string; action: string;
  module: string; detail: string; ip: string; type: 'create'|'update'|'delete'|'login'|'export';
}

const EVENTS: AuditEvent[] = [
  { id:'E-1247', horodatage:'14/05/2026 09:42', utilisateur:'Admin Super',   action:'Modification règle SLA', module:'Règles',      detail:'SLA-047 — délai intervention modifié 4h→2h',   ip:'192.168.1.12', type:'update' },
  { id:'E-1246', horodatage:'14/05/2026 08:15', utilisateur:'Maria Romain',  action:'Invitation utilisateur', module:'Utilisateurs', detail:'frantz.joseph@dinepa.ht invité — rôle TEPAC',  ip:'10.0.0.45',    type:'create' },
  { id:'E-1245', horodatage:'14/05/2026 07:58', utilisateur:'Admin Super',   action:'Export données',         module:'Rapports',    detail:'Export CSV — capteurs Léogâne 30 derniers jours', ip:'192.168.1.12', type:'export' },
  { id:'E-1244', horodatage:'13/05/2026 17:22', utilisateur:'Marc Désir',    action:'Mise à jour institution', module:'Institutions', detail:'URD Ouest — 3 communes ajoutées',             ip:'10.0.0.23',    type:'update' },
  { id:'E-1243', horodatage:'13/05/2026 14:10', utilisateur:'Admin Super',   action:'Nouvelle politique',     module:'Politiques',  detail:'POL-2026-008 — proc. notification usagers v1.5', ip:'192.168.1.12', type:'create' },
  { id:'E-1242', horodatage:'13/05/2026 11:35', utilisateur:'Pierre Léger',  action:'Connexion',              module:'Auth',        detail:'Connexion — MFA vérifié — navigateur Chrome',  ip:'81.24.12.99',  type:'login'  },
  { id:'E-1241', horodatage:'12/05/2026 16:20', utilisateur:'Admin Super',   action:'Suppression capteur',    module:'IoT',         detail:'CPT-DB-003 supprimé — hors service confirmé',   ip:'192.168.1.12', type:'delete' },
  { id:'E-1240', horodatage:'12/05/2026 09:05', utilisateur:'Sara Cadet',    action:'Modification rôle',      module:'Utilisateurs', detail:'Marie Pierre — TEPAC → SUPERVISEUR_URD',       ip:'10.0.0.67',    type:'update' },
];

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, GovShellComponent],
  templateUrl: './audit.component.html',
  styleUrls: ['./audit.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditComponent {
  readonly events = EVENTS;
  readonly recherche = signal('');
  readonly typeFilter = signal('tous');

  typeCls(t: AuditEvent['type']): string {
    const MAP: Record<string, string> = {
      create: 'aud-type--green',  update: 'aud-type--blue',
      delete: 'aud-type--red',   login:  'aud-type--gray',
      export: 'aud-type--amber',
    };
    return MAP[t] ?? '';
  }
}
