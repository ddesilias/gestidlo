import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GovShellComponent } from '../shared/gov-shell.component';
import { GenererRapportModalComponent } from './generer-rapport-modal/generer-rapport-modal.component';

type ConfTab = 'calendrier' | 'normes' | 'modeles' | 'zones';

interface EcheanceUrgente {
  ref: string; jour: number; mois: string; delai: string;
  titre: string; sous: string;
  badge: string; badgeCls: string;
  btnLabel: string; btnCls: string; urgenceCls: string;
}
interface EcheanceMois { jour: number; mois: string; titre: string; sous: string; mode: string; }
interface EcheanceSoumise { ref: string; label: string; date: string; }
interface Norme { titre: string; sous: string; statutLabel: string; statutCls: string; note: string; iconCls: string; }
interface ModeleRapport { titre: string; sous: string; version: string; }
interface ZoneConf { zone: string; pct: number; }

@Component({
  selector: 'app-conformite',
  standalone: true,
  imports: [CommonModule, GovShellComponent, GenererRapportModalComponent],
  templateUrl: './conformite.component.html',
  styleUrls: ['./conformite.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConformiteComponent {
  readonly activeTab = signal<ConfTab>('calendrier');
  readonly showGenererModal = signal(false);

  readonly progressPct = 38;
  readonly soumisCount = 5;
  readonly totalCount = 13;
  readonly nationalPct = 92;

  readonly TABS: { id: ConfTab; label: string }[] = [
    { id: 'calendrier', label: 'Calendrier réglementaire' },
    { id: 'normes',     label: 'Normes en vigueur' },
    { id: 'modeles',    label: 'Modèles de rapports' },
    { id: 'zones',      label: 'Conformité par zone' },
  ];

  readonly echeancesUrgentes: EcheanceUrgente[] = [
    {
      ref: 'RPT-MENS-2026-05', jour: 15, mois: 'Mai', delai: 'demain',
      titre: 'Rapport mensuel DINEPA — Avril 2026',
      sous: 'Données collectées · prêt à signer · Maria Romain doit valider',
      badge: 'OBLIGATOIRE', badgeCls: 'badge-rouge',
      btnLabel: 'Générer & envoyer', btnCls: 'btn-rouge', urgenceCls: 'urg-rouge',
    },
    {
      ref: 'RPT-Q1-2026', jour: 18, mois: 'Mai', delai: 'dans 4j',
      titre: 'Bilan qualité eau Q1 2026 — OREPA Ouest',
      sous: 'Données 947 mesures · pH/NTU/chlore · format DINEPA 2024',
      badge: 'TRIMESTRIEL', badgeCls: 'badge-amber',
      btnLabel: 'Préparer', btnCls: 'btn-default', urgenceCls: 'urg-amber',
    },
    {
      ref: 'AUDIT-2026-A', jour: 21, mois: 'Mai', delai: 'dans 7j',
      titre: 'Audit annuel rétention des données',
      sous: 'Vérification 12 mois de logs · Pierre Léger',
      badge: 'AUDIT INTERNE', badgeCls: 'badge-violet',
      btnLabel: 'Planifier', btnCls: 'btn-default', urgenceCls: 'urg-amber',
    },
  ];

  readonly echeancesMois: EcheanceMois[] = [
    { jour: 30, mois: 'Mai', titre: 'Déclaration incidents majeurs mensuelle', sous: 'Auto-générée · validation DINEPA national', mode: 'Auto' },
    { jour: 31, mois: 'Mai', titre: 'Bilan interventions terrain — OREPA Ouest', sous: 'PV consolidés · 47 interventions', mode: 'Manuel' },
  ];

  readonly echeancesSoumises: EcheanceSoumise[] = [
    { ref: 'RPT-MENS-2026-04', label: 'Mars 2026',    date: 'soumis 14/04' },
    { ref: 'RPT-MENS-2026-03', label: 'Février 2026', date: 'soumis 15/03' },
    { ref: 'RPT-MENS-2026-02', label: 'Janvier 2026', date: 'soumis 14/02' },
    { ref: 'RPT-ANN-2025',     label: 'Annuel 2025',  date: 'soumis 31/01' },
    { ref: 'RPT-Q4-2025',      label: 'Q4 2025',      date: 'soumis 12/01' },
  ];

  readonly normes: Norme[] = [
    { titre: 'DINEPA — Loi 2009',               sous: 'Cadre national AEP · obligations opérateurs',   statutLabel: '✓ EN VIGUEUR', statutCls: 'stt-green',  note: 'depuis 2009',                iconCls: 'ico-violet'  },
    { titre: 'OMS — Directives qualité eau',     sous: '4ème édition 2017 + addenda 2022',              statutLabel: '✓ EN VIGUEUR', statutCls: 'stt-green',  note: 'référence internationale',   iconCls: 'ico-green'   },
    { titre: 'Norme MARNDR — Eaux résiduaires', sous: 'Min. Agriculture · pollution agricole',          statutLabel: 'PARTIELLE',    statutCls: 'stt-amber',  note: 'applicable sections rurales', iconCls: 'ico-amber'   },
    { titre: 'ISO 24512 — Services eau potable', sous: 'Gestion qualité · bonnes pratiques',            statutLabel: 'RÉFÉRENCE',    statutCls: 'stt-gray',   note: 'objectif certification 2027', iconCls: 'ico-violet2' },
  ];

  readonly modeles: ModeleRapport[] = [
    { titre: 'Mensuel DINEPA',            sous: '12 sections · 8 tableaux',    version: 'v2.3' },
    { titre: 'Bilan qualité trimestriel', sous: 'graphiques + analyse',        version: 'v1.5' },
    { titre: 'Rapport annuel national',   sous: 'consolidation 10 dépts',      version: 'v3.0' },
    { titre: 'Déclaration incident 24h',  sous: 'urgence · 1 page',            version: 'v2.0' },
    { titre: 'PV intervention type',      sous: 'terrain · photos · signature', version: 'v1.2' },
    { titre: 'Bulletin usagers (SMS)',    sous: 'communication publique',       version: 'v1.0' },
  ];

  readonly zones: ZoneConf[] = [
    { zone: 'Léogâne',     pct: 95 },
    { zone: 'Petit-Goâve', pct: 88 },
    { zone: 'OREPA Ouest', pct: 92 },
  ];
}
