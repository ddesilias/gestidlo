import {
  ChangeDetectionStrategy, Component, EventEmitter, HostListener, Output, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type ScanTab = 'camera' | 'image' | 'nfc' | 'manuel';

interface ScanResult {
  code: string;
  numSerie: string;
  modele: string;
  statut: 'new' | 'exists';
}

@Component({
  selector: 'app-scanner-qr',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scanner-qr.component.html',
  styleUrls: ['./scanner-qr.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScannerQrComponent {
  @Output() fermer    = new EventEmitter<void>();
  @Output() ouvrirFiche = new EventEmitter<string>();

  readonly onglet    = signal<ScanTab>('camera');
  readonly scanning  = signal(true);
  readonly detected  = signal<ScanResult | null>({
    code: 'CPT-PR-018',
    numSerie: 'SN-2026-A12F4',
    modele: 'Danfoss MBS 3000',
    statut: 'exists',
  });

  readonly TABS: { id: ScanTab; label: string }[] = [
    { id: 'camera', label: 'Caméra' },
    { id: 'image',  label: 'Image' },
    { id: 'nfc',    label: 'NFC' },
    { id: 'manuel', label: 'Saisie manuelle' },
  ];

  // Saisie manuelle
  saisiCode = '';

  setTab(t: ScanTab): void { this.onglet.set(t); }

  resetScan(): void {
    this.detected.set(null);
    this.scanning.set(true);
  }

  onOuvrirFiche(): void {
    const d = this.detected();
    if (d) this.ouvrirFiche.emit(d.code);
    this.fermer.emit();
  }

  onSaisirCode(): void {
    if (!this.saisiCode.trim()) return;
    this.detected.set({
      code: this.saisiCode.trim().toUpperCase(),
      numSerie: 'SN-2026-XXXX',
      modele: 'Inconnu',
      statut: 'new',
    });
    this.scanning.set(false);
  }

  @HostListener('keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') this.fermer.emit();
  }
}
