package com.example.api_metier.domain;

/**
 * Statuts d'un ticket / intervention.
 *
 * <p>Les 4 premiers ({@code OPEN…CLOSED}) sont l'ancien cycle des tickets nés d'une alerte
 * (Camunda, {@code advance()}) — conservés pour ne rien casser. Les suivants forment le
 * workflow « ordre de travail » superviseur → technicien : un superviseur crée en
 * {@code BROUILLON}, envoie ({@code ENVOYEE}), le technicien accepte/refuse, démarre,
 * termine, puis le rapport est soumis et le superviseur valide.
 */
public enum TicketStatus {
	// Cycle historique (tickets nés d'alerte).
	OPEN,
	ASSIGNED,
	IN_PROGRESS,
	CLOSED,
	// Cycle « ordre de travail » (intervention superviseur → technicien).
	BROUILLON,
	ENVOYEE,
	RECUE,
	ACCEPTEE,
	EN_COURS,
	EN_PAUSE,
	TERMINEE,
	RAPPORT_SOUMIS,
	VALIDEE,
	REJETEE,
	ANNULEE
}
