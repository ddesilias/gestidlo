package com.example.api_metier.domain;

/**
 * Cycle de vie d'un rapport. Deux usages se superposent sur la même machine :
 *
 * <ul>
 *   <li><b>Circuit terrain</b> (TEPAC → superviseur → admin) :
 *       BROUILLON → TRANSMIS (soumis, à valider) → VALIDE (validé par le superviseur)
 *       → TRANSMIS_ADMIN (signé + relayé à l'admin national) → ARCHIVE.
 *       Un renvoi repart en BROUILLON avec motif (correction demandée).</li>
 *   <li><b>Wizard admin</b> historique : BROUILLON/GENERE → TRANSMIS → VALIDE → ARCHIVE.</li>
 * </ul>
 *
 * <p>Le superviseur n'est pas un terminus mais un <b>relais signataire</b> : d'où
 * {@code TRANSMIS_ADMIN} entre {@code VALIDE} (sa décision) et l'archivage admin.
 */
public enum RapportStatus {
	BROUILLON,
	GENERE,
	TRANSMIS,
	VALIDE,
	TRANSMIS_ADMIN,
	ARCHIVE
}
