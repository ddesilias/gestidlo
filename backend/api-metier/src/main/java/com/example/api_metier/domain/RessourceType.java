package com.example.api_metier.domain;

/** Type de ressource naturelle en eau. Une source est ponctuelle (1 département) ;
 * une rivière ou un bassin versant peut traverser plusieurs départements (N–N). */
public enum RessourceType {
    SOURCE,
    RIVIERE,
    BASSIN
}
