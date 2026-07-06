package com.example.api_metier.domain;

/**
 * Statut du cycle de validation d'un capteur (même logique que {@link RessourceStatut} /
 * {@link OuvrageValidation}). Le TEPAC <em>déclare/installe</em> ({@link #EN_ATTENTE_VALIDATION}) ;
 * le superviseur d'URD <em>valide</em> ({@link #VALIDEE}, capteur officiellement actif) ou
 * <em>rejette</em> ({@link #REJETEE}). Capteur créé par superviseur/admin (ou seedé) = {@link #VALIDEE}.
 */
public enum CapteurValidation {
    EN_ATTENTE_VALIDATION,
    VALIDEE,
    REJETEE
}
