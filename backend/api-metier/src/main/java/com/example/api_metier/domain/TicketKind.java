package com.example.api_metier.domain;

/**
 * Nature d'un ticket : distingue les deux familles qui partagent {@link TicketEntity}.
 *
 * <ul>
 *   <li>{@code ALERTE} — ticket né d'une alerte (auto), piloté par Camunda + {@code advance()}.</li>
 *   <li>{@code ORDRE} — ordre de travail créé par un superviseur, transitions MANUELLES
 *       (envoyer/accepter/…), jamais Camunda.</li>
 * </ul>
 *
 * Les lignes existantes (NULL en base) sont traitées comme {@code ALERTE} et rétro-remplies au
 * démarrage. La page Interventions filtre par {@code kind=ORDRE}.
 */
public enum TicketKind {
	ALERTE,
	ORDRE
}
