package com.example.api_metier.domain;

/** État opérationnel de l'ouvrage (≠ statut de validation). Aligné sur l'`InfraStatus` du SPA. */
public enum OuvrageEtat {
    OPERATIONNEL,
    MAINTENANCE,
    PANNE,
    VETUSTE
}
