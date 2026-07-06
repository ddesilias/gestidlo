import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ZoneRegistreService } from '../../../zone-registre.service';
import { ZoneLiaisonService } from '../../../zone-liaison.service';
import { InfrastructureStore, Infrastructure } from '../../../infrastructure.store';
import { ZoneFiche, LienRole, ZoneInfrastructureLien } from '../../../zone.models';

interface AttachForm { role: LienRole; anchor: string; quotePart: string; }

const ROLE_LABELS: Record<LienRole, string> = {
  alimente: 'Alimente (source)',
  stocke:   'Stocke (réservoir)',
  dessert:  'Dessert (distribution)',
};

const INFRA_TYPE_ICONS: Record<string, string> = {
  captage:    'ti-droplet',
  reservoir:  'ti-cylinder',
  pompe:      'ti-engine',
  traitement: 'ti-filter',
  'point-eau':'ti-tap',
  borne:      'ti-water-pole',
  kiosque:    'ti-building-store',
  conduite:   'ti-minus',
  passerelle: 'ti-wifi',
  energie:    'ti-bolt',
};

@Component({
  selector: 'app-liaison-zone',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './liaison-zone.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiaisonZoneComponent implements OnInit {
  readonly zoneId = signal('');
  readonly zone   = signal<ZoneFiche | null>(null);

  // Inline attach forms keyed by infraId
  readonly attachForms = signal<Record<string, AttachForm>>({});
  // Anchor edit state keyed by lienId
  readonly anchorForms = signal<Record<string, string>>({});

  readonly roles: { value: LienRole; label: string }[] = [
    { value: 'alimente', label: 'Alimente (source)' },
    { value: 'stocke',   label: 'Stocke (réservoir)' },
    { value: 'dessert',  label: 'Dessert (distribution)' },
  ];

  // Infrastructures in the same commune, not yet attached
  readonly infrasProposees = computed(() => {
    const z = this.zone();
    if (!z) return [];
    void this.liaisonService.version(); // reactivity
    return this.infraStore.snapshot.filter(
      i => i.commune === z.commune && !this.liaisonService.isAttached(z.id, i.id)
    );
  });

  // Already attached infras with their lien
  readonly infrasAttachees = computed((): Array<{ lien: ZoneInfrastructureLien; infra: Infrastructure }> => {
    const z = this.zone();
    if (!z) return [];
    return this.liaisonService.liens()
      .filter(l => l.zoneId === z.id && l.statut === 'actif')
      .map(l => ({ lien: l, infra: this.infraStore.snapshot.find(i => i.id === l.infrastructureId)! }))
      .filter(x => !!x.infra);
  });

  // Source débit check: is any "alimente" infra providing enough for qpj?
  readonly sourceOk = computed(() => {
    const z = this.zone();
    if (!z || !z.qpj) return false;
    return this.infrasAttachees().some(({ lien, infra }) => {
      if (lien.role !== 'alimente') return false;
      const match = infra.capacity?.match(/(\d+(?:[,\.]\d+)?)\s*[Ll]\/s/);
      if (!match) return false;
      const debit = parseFloat(match[1].replace(',', '.'));
      const quotePart = lien.quotePartDebit ?? 100;
      return debit * quotePart / 100 >= (z.qpj ?? 0);
    });
  });

  constructor(
    private route:          ActivatedRoute,
    private router:         Router,
    private zoneService:    ZoneRegistreService,
    readonly liaisonService: ZoneLiaisonService,
    readonly infraStore:     InfrastructureStore,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('zoneId') ?? '';
    this.zoneId.set(id);
    this.zone.set(this.zoneService.getZone(id) ?? null);
  }

  // ── Attach / detach ───────────────────────────────────────────────

  openAttach(infraId: string): void {
    this.attachForms.update(m => ({ ...m, [infraId]: { role: 'alimente', anchor: '', quotePart: '100' } }));
  }
  closeAttach(infraId: string): void {
    this.attachForms.update(m => { const { [infraId]: _, ...rest } = m; return rest; });
  }
  confirmAttach(infraId: string): void {
    const z = this.zone();
    const form = this.attachForms()[infraId];
    if (!z || !form) return;
    const qp = parseFloat(form.quotePart);
    this.liaisonService.attach(
      z.id, infraId, form.role,
      form.anchor || undefined,
      isNaN(qp) || qp >= 100 ? undefined : qp,
    );
    this.closeAttach(infraId);
    this.zoneService.addJournal(z.id, `Ouvrage rattaché · ${this.infraStore.snapshot.find(i => i.id === infraId)?.name ?? infraId} · rôle ${form.role}`);
  }

  detach(lienId: string): void {
    const z = this.zone();
    if (!z) return;
    const lien = this.liaisonService.liens().find(l => l.id === lienId);
    if (lien) {
      this.zoneService.addJournal(z.id, `Ouvrage détaché · ${this.infraStore.snapshot.find(i => i.id === lien.infrastructureId)?.name ?? ''}`);
    }
    this.liaisonService.detach(lienId);
  }

  // ── Anchor ────────────────────────────────────────────────────────

  openAnchor(lienId: string, current: string | undefined): void {
    this.anchorForms.update(m => ({ ...m, [lienId]: current ?? '' }));
  }
  closeAnchor(lienId: string): void {
    this.anchorForms.update(m => { const { [lienId]: _, ...rest } = m; return rest; });
  }
  confirmAnchor(lienId: string): void {
    const val = this.anchorForms()[lienId];
    if (val === undefined) return;
    this.liaisonService.setAnchor(lienId, val);
    this.closeAnchor(lienId);
  }

  // ── Navigation ────────────────────────────────────────────────────

  naviguerNouvelOuvrage(): void {
    const z = this.zone();
    this.router.navigate(['/admin/infrastructures'], {
      queryParams: z ? { dept: z.dept, commune: z.commune, zone: z.id } : {}
    });
  }

  retour(): void { this.router.navigate(['/admin/governance/territoire']); }

  // ── Utils ─────────────────────────────────────────────────────────

  iconFor(type: string): string { return INFRA_TYPE_ICONS[type] ?? 'ti-building-factory'; }
  roleLabel(role: LienRole): string { return ROLE_LABELS[role]; }

  updateAttachField(infraId: string, field: keyof AttachForm, value: string): void {
    this.attachForms.update(m => {
      const existing = m[infraId];
      if (!existing) return m;
      return { ...m, [infraId]: { ...existing, [field]: value } };
    });
  }
  updateAnchorField(lienId: string, value: string): void {
    this.anchorForms.update(m => ({ ...m, [lienId]: value }));
  }
}
