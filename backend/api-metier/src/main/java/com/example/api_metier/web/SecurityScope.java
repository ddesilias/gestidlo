package com.example.api_metier.web;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Périmètre de l'appelant dérivé du token JWT (claims posés au login).
 *
 * <p>Source unique des garde-fous de scope côté serveur : qu'il s'agisse de filtrer une
 * lecture (alertes) ou de rejeter une écriture hors périmètre (ressources), la vérité du
 * périmètre vient du token, jamais d'un paramètre client. Un superviseur d'URD est
 * verrouillé sur le département porté par son token.
 */
final class SecurityScope {

    private SecurityScope() {}

    static boolean isSupervisor(Authentication auth) {
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_SUPERVISEUR_URD".equals(a.getAuthority()));
    }

    /** Département du token (claim {@code dept}), ou {@code null} pour un compte hors URD (admin). */
    static String tokenDept(Authentication auth) {
        return (auth != null && auth.getPrincipal() instanceof Jwt jwt) ? jwt.getClaimAsString("dept") : null;
    }
}
