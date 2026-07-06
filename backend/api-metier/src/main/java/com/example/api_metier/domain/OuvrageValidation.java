package com.example.api_metier.domain;

/**
 * Statut du cycle de validation d'un ouvrage (même logique que {@link RessourceStatut}).
 * Le TEPAC <em>soumet</em> ({@link #EN_ATTENTE_VALIDATION}) ; le superviseur d'URD <em>valide</em>
 * ({@link #VALIDEE}, l'ouvrage rejoint le patrimoine officiel) ou <em>rejette</em> ({@link #REJETEE}).
 * Un ouvrage créé par un superviseur/admin (ou seedé) est {@link #VALIDEE} d'office.
 */
public enum OuvrageValidation {
    EN_ATTENTE_VALIDATION,
    VALIDEE,
    REJETEE
}
