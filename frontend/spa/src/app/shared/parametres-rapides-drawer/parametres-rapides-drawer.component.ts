import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

type Theme = 'dark' | 'midnight' | 'slate';
type TextSize = 'sm' | 'md' | 'lg';
type Lang = 'fr' | 'en' | 'ht';

@Component({
  selector: 'app-parametres-rapides-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parametres-rapides-drawer.component.html',
  styleUrls: ['./parametres-rapides-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParametresRapidesDrawerComponent {
  @Input() visible = false;
  @Output() fermer = new EventEmitter<void>();

  private readonly router = inject(Router);

  readonly theme    = signal<Theme>('dark');
  readonly lang     = signal<Lang>('fr');
  readonly textSize = signal<TextSize>('md');

  notifAlertes     = signal(true);
  notifSla         = signal(true);
  notifIntervention= signal(false);
  notifRapports    = signal(true);

  scopeZone = 'Léogâne · Petit-Goâve';

  readonly THEMES: { id: Theme; label: string; cls: string }[] = [
    { id: 'dark',     label: 'Sombre',   cls: 'prm-theme--dark'     },
    { id: 'midnight', label: 'Minuit',   cls: 'prm-theme--midnight' },
    { id: 'slate',    label: 'Ardoise',  cls: 'prm-theme--slate'    },
  ];

  readonly LANGS: { id: Lang; label: string }[] = [
    { id: 'fr', label: 'Français'  },
    { id: 'en', label: 'English'   },
    { id: 'ht', label: 'Kreyòl'   },
  ];

  readonly SHORTCUTS = [
    { key: '⌘K',    label: 'Recherche globale' },
    { key: '⌘N',    label: 'Nouvelle alerte'   },
    { key: '⌘E',    label: 'Exporter rapport'  },
    { key: '⌘/',    label: 'Aide & raccourcis' },
  ];

  selectTheme(t: Theme): void { this.theme.set(t); }
  selectLang(l: Lang): void   { this.lang.set(l);   }
  selectSize(s: TextSize): void { this.textSize.set(s); }

  voirTousParametres(): void {
    this.fermer.emit();
    this.router.navigateByUrl('/governance/config');
  }

  changerMotDePasse(): void {
    console.log('Ouvrir changement mot de passe');
    alert('Redirection vers la gestion du compte…');
  }

  gerer2fa(): void {
    console.log('Gérer 2FA');
    alert('Authentification à deux facteurs — paramétrage en cours…');
  }

  voirSessions(): void {
    console.log('Sessions actives');
    alert('1 session active : Chrome / Windows 11 — Port-au-Prince');
  }

  deconnecter(): void {
    this.fermer.emit();
    this.router.navigateByUrl('/login');
  }

  sauvegarder(): void {
    console.log('Paramètres sauvegardés :', { theme: this.theme(), lang: this.lang(), textSize: this.textSize() });
    this.fermer.emit();
  }
}
