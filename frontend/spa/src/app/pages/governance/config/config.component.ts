import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GovShellComponent } from '../shared/gov-shell.component';

@Component({
  selector: 'app-gov-config',
  standalone: true,
  imports: [CommonModule, FormsModule, GovShellComponent],
  templateUrl: './config.component.html',
  styleUrls: ['./config.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GovConfigComponent {
  readonly saved = signal(false);

  // Système
  nomSysteme = 'GestiDLO DINEPA';
  versionApi = 'v2.3.1';
  environnement = 'production';
  fuseauHoraire = 'America/Port-au-Prince';

  // Notifications
  emailNotif = true;
  smsNotif = true;
  pushNotif = false;
  seuilNotifCritique = 5;

  // Sessions
  dureeSession = 480;
  mfa = true;
  tentativesMax = 5;

  // Licences
  maxLicences = 30;
  licencesActives = 24;

  get licencesPct(): string {
    return Math.round((this.licencesActives / this.maxLicences) * 100).toString();
  }

  save(): void {
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 3000);
  }
}
