import {
  ChangeDetectionStrategy, Component, computed, EventEmitter,
  inject, OnInit, Output, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  Intervention, InterventionPriority, InterventionStore, InterventionType,
} from '../../../intervention.store';
import { AlertStore } from '../../../alert.store';
import { GovernanceStore } from '../../../governance.store';
import { InfrastructureStore } from '../../../infrastructure.store';
import { HaitiGeoService, HAITI_DEPARTMENTS, orepaForDept } from '../../../haiti-geo.service';
import { InterventionStateService } from '../intervention-state.service';
import { ToastService } from '../../../ui/toast.service';
import { SUGGESTION_PAR_SEVERITE } from '../../alertes/alerte.types';

export type FormMode = '' | 'alerte' | 'autonome';

interface NiForm {
  type:             InterventionType | '';
  priority:         InterventionPriority | '';
  title:            string;
  description:      string;
  department:       string;
  commune:          string;
  section:          string;
  infrastructureId: string;
  institutionId:    string;
  technicianId:     string;
  tasksText:        string;
}

@Component({
  selector: 'app-nouvelle-intervention',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nouvelle-intervention.component.html',
  styleUrls: ['./nouvelle-intervention.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NouvelleInterventionComponent implements OnInit {
  @Output() fermer = new EventEmitter<void>();

  private readonly state      = inject(InterventionStateService);
  private readonly store      = inject(InterventionStore);
  private readonly alertStore = inject(AlertStore);
  readonly govStore           = inject(GovernanceStore);
  readonly infraStore         = inject(InfrastructureStore);
  private readonly geo        = inject(HaitiGeoService);
  private readonly toast      = inject(ToastService);

  readonly departments = HAITI_DEPARTMENTS;

  // ── Origin / mode ─────────────────────────────────────────────────────────────
  readonly mode = signal<FormMode>('');

  // Backing string for the alert selector ngModel; synced to the signal below
  sourceAlertIdBind = '';
  private readonly _sourceAlertId = signal('');

  // ── Form data ─────────────────────────────────────────────────────────────────
  form: NiForm = this.emptyForm();

  // ── Cascade signals (drive computed(); updated from (ngModelChange) handlers) ─
  private readonly _dept          = signal('');
  private readonly _commune       = signal('');
  private readonly _institutionId = signal('');

  // ── Computed ──────────────────────────────────────────────────────────────────
  readonly alertesActives = computed(() => this.alertStore.getActive());

  readonly alerteSelectionnee = computed(() =>
    this.alertStore.snapshot.find(a => a.id === this._sourceAlertId()) ?? null
  );

  readonly orepaDetecte = computed((): string | null => {
    const dept = this.mode() === 'alerte'
      ? (this.alerteSelectionnee()?.department ?? '')
      : this._dept();
    return dept ? orepaForDept(dept) : null;
  });

  readonly communesDisponibles = computed(() => this.geo.communesForDept(this._dept()));
  readonly sectionsDisponibles = computed(() =>
    this.geo.sectionsForScope(this._commune(), this._dept())
  );

  readonly institutionsFiltrees = computed(() => {
    const dept = this.mode() === 'alerte'
      ? (this.alerteSelectionnee()?.department ?? '')
      : this._dept();
    if (!dept) return this.govStore.institutions;
    return this.govStore.institutions.filter(i =>
      i.department === dept || i.level === 'National'
    );
  });

  readonly techniciensDisponibles = computed(() => {
    const inst = this.govStore.institutions.find(i => i.id === this._institutionId());
    return this.govStore.techniciensForInstitution(inst?.name ?? '');
  });

  readonly superviseurOrepa = computed(() => {
    const dept = this.mode() === 'alerte'
      ? (this.alerteSelectionnee()?.department ?? '')
      : this._dept();
    if (!dept) return null;
    return this.govStore.institutions.find(i =>
      i.name.toLowerCase().includes('orepa') && i.department === dept
    ) ?? null;
  });

  // ── Workload (charge) ─────────────────────────────────────────────────────────
  readonly chargeTechniciens = computed(() => {
    const map = new Map<string, number>();
    for (const i of this.state.toutesLesInterventions()) {
      if (['creee', 'assignee', 'en-cours', 'en-attente'].includes(i.status) && i.technicianId) {
        map.set(i.technicianId, (map.get(i.technicianId) ?? 0) + 1);
      }
    }
    return map;
  });

  chargeForTech(techId: string): number {
    return this.chargeTechniciens().get(techId) ?? 0;
  }

  isTechAssignable(techId: string): boolean {
    return this.chargeForTech(techId) < 5;
  }

  readonly allTechsAtCap = computed(() => {
    const techs = this.techniciensDisponibles();
    if (!techs.length) return false;
    const map = this.chargeTechniciens();
    return techs.every(t => (map.get(t.id) ?? 0) >= 5);
  });

  chargeDots(techId: string): boolean[] {
    const n = this.chargeForTech(techId);
    return [1, 2, 3, 4, 5].map(i => i <= n);
  }

  chargeClass(techId: string): string {
    const n = this.chargeForTech(techId);
    if (n >= 5) return 'red';
    if (n === 4) return 'orange';
    return 'green';
  }

  chargeLabel(techId: string): string {
    const n = this.chargeForTech(techId);
    if (n === 0) return 'Disponible';
    if (n === 4) return '4/5 — Dernier créneau';
    if (n >= 5)  return '5/5 — Plafond atteint';
    return `${n}/5`;
  }

  initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    const donnees = this.state.donneesPreremplies();
    if (!donnees) return;

    if (donnees.sourceAlertId) {
      this.mode.set('alerte');
      this.sourceAlertIdBind = donnees.sourceAlertId;
      this._sourceAlertId.set(donnees.sourceAlertId);
      this.fillFromAlert();
    } else {
      this.mode.set('autonome');
      this.form.department = donnees.departement;
      this.form.commune    = donnees.commune;
      this.form.section    = donnees.section;
      this.form.type       = donnees.type;
      this.form.priority   = donnees.priorite;
      this.form.title      = donnees.titre;
      this.form.description = donnees.description;
      this.form.infrastructureId = donnees.infraId;
      if (donnees.departement) this._dept.set(donnees.departement);
      if (donnees.commune)     this._commune.set(donnees.commune);
    }
  }

  // ── Mode selection ────────────────────────────────────────────────────────────
  choisirMode(m: FormMode): void {
    if (this.mode() === m) return;
    this.mode.set(m);
    this.form = this.emptyForm();
    this.sourceAlertIdBind = '';
    this._sourceAlertId.set('');
    this._dept.set('');
    this._commune.set('');
    this._institutionId.set('');
  }

  // ── Alert selection ───────────────────────────────────────────────────────────
  onSourceAlertChange(id: string): void {
    this._sourceAlertId.set(id);
    this.form.institutionId = '';
    this.form.technicianId  = '';
    this._institutionId.set('');
    this.fillFromAlert();
  }

  private fillFromAlert(): void {
    const a = this.alerteSelectionnee();
    if (!a) return;
    const suggestion = SUGGESTION_PAR_SEVERITE[a.severity];
    this.form.type             = suggestion.type;
    this.form.priority         = suggestion.priorite;
    this.form.title            = `[${a.code}] ${a.title}`;
    this.form.description      = a.description;
    this.form.department       = a.department;
    this.form.commune          = a.commune;
    this.form.section          = a.section ?? '';
    this.form.infrastructureId = a.infrastructureId ?? '';
    this._dept.set(a.department);
    this._commune.set(a.commune);
  }

  // ── Form helpers ──────────────────────────────────────────────────────────────
  private emptyForm(): NiForm {
    return {
      type: '', priority: '', title: '', description: '',
      department: '', commune: '', section: '',
      infrastructureId: '', institutionId: '', technicianId: '', tasksText: '',
    };
  }

  canSubmit(): boolean {
    return this.mode() !== '' &&
           !!this.form.type && !!this.form.title.trim() &&
           !!this.form.institutionId && !!this.form.technicianId &&
           this.isTechAssignable(this.form.technicianId);
  }

  onDeptChange(): void {
    this._dept.set(this.form.department);
    this.form.commune       = '';
    this.form.section       = '';
    this.form.institutionId = '';
    this.form.technicianId  = '';
    this._commune.set('');
    this._institutionId.set('');
  }

  onCommuneChange(): void {
    this._commune.set(this.form.commune);
    this.form.section = '';
  }

  onInstitutionChange(): void {
    this._institutionId.set(this.form.institutionId);
    this.form.technicianId = '';
  }

  get technicienSelectionne(): string {
    const t = this.govStore.techniciens.find(t => t.id === this.form.technicianId);
    return t?.name ?? '—';
  }

  severityColor(sev: string): string {
    const map: Record<string, string> = {
      critique: '#ef4444', haute: '#f97316', moyenne: '#eab308', basse: '#94a3b8',
    };
    return map[sev] ?? '#94a3b8';
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  submit(): void {
    if (!this.canSubmit()) return;

    const inst     = this.govStore.institutions.find(i => i.id === this.form.institutionId)!;
    const tech     = this.govStore.techniciens.find(t => t.id === this.form.technicianId)!;
    const infra    = this.form.infrastructureId
      ? this.infraStore.snapshot.find(i => i.id === this.form.infrastructureId)
      : undefined;
    const alertRef = this._sourceAlertId()
      ? this.alertStore.snapshot.find(a => a.id === this._sourceAlertId())
      : undefined;

    const tasks = this.form.tasksText
      .split('\n').map(s => s.trim()).filter(Boolean)
      .map((label, idx) => ({ id: `task-${Date.now()}-${idx}`, label, done: false }));

    const seq  = this.store.snapshot.length + 1;
    const code = `INT-${new Date().getFullYear()}-${String(seq).padStart(3, '0')}`;

    const intervention: Intervention = {
      id: `int-${Date.now()}`,
      code,
      type:               this.form.type as InterventionType,
      title:              this.form.title,
      description:        this.form.description,
      status:             'creee',
      priority:           (this.form.priority || 'normale') as InterventionPriority,
      sourceAlertId:      alertRef?.id,
      sourceAlertCode:    alertRef?.code,
      infrastructureId:   infra?.id,
      infrastructureName: infra?.name,
      commune:            this.form.commune || infra?.commune,
      department:         this.form.department || infra?.department,
      section:            this.form.section   || infra?.section,
      institutionId:      inst.id,
      institutionName:    inst.name,
      technicianId:       tech.id,
      technicianName:     tech.name,
      assignedBy:         'admin',
      createdAt:          new Date().toISOString(),
      tasks,
    };

    this.store.add(intervention);

    if (alertRef) {
      this.alertStore.update({
        ...alertRef,
        status:         'en-cours',
        interventionId: intervention.id,
        updatedAt:      new Date().toISOString(),
      });
    }

    // Double notification: technician + supervisor (supervisor always in loop)
    this.toast.push('info', `Technicien ${tech.name} notifié`);
    const sup = this.superviseurOrepa();
    if (sup) {
      this.toast.push('info', `Superviseur ${sup.primaryContact} notifié (${this.orepaDetecte()})`);
    }

    this.state.selectionner(intervention);
    this.fermer.emit();
  }
}
