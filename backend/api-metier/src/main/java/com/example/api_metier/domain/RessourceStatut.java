package com.example.api_metier.domain;

/**
 * Statut du cycle de validation d'une ressource.
 *
 * <p>Le technicien (TEPAC) <em>recense</em> : la ressource entre en
 * {@link #EN_ATTENTE_VALIDATION}. Le superviseur d'URD <em>valide</em> ({@link #VALIDEE},
 * elle rejoint le patrimoine officiel) ou <em>rejette</em> ({@link #REJETEE}, avec motif).
 * Les ressources créées directement par un superviseur/admin sont {@link #VALIDEE} d'office.
 */
public enum RessourceStatut {
    EN_ATTENTE_VALIDATION,
    VALIDEE,
    REJETEE
}
