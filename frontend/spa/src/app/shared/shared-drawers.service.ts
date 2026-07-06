import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SharedDrawersService {
  readonly showNouveauReglement  = signal(false);
  readonly showExporterRapport   = signal(false);
  readonly showParametresRapides = signal(false);
  readonly showInviterUtilisateur= signal(false);

  readonly lastCreatedRuleCode = signal<string | null>(null);

  openNouveauReglement()   { this.showNouveauReglement.set(true);  }
  openExporterRapport()    { this.showExporterRapport.set(true);   }
  openParametresRapides()  { this.showParametresRapides.set(true); }
  openInviterUtilisateur() { this.showInviterUtilisateur.set(true);}

  setLastCreatedRule(code: string): void { this.lastCreatedRuleCode.set(code); }
  clearLastCreatedRule(): void { this.lastCreatedRuleCode.set(null); }

  closeAll() {
    this.showNouveauReglement.set(false);
    this.showExporterRapport.set(false);
    this.showParametresRapides.set(false);
    this.showInviterUtilisateur.set(false);
  }
}
