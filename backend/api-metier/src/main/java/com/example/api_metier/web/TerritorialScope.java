package com.example.api_metier.web;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

/**
 * Résolveur de périmètre territorial UNIQUE, partagé par tous les modules de lecture
 * (alertes, tickets, ressources, rapports, zones, acteurs). Le rôle porté par le JWT
 * détermine la LARGEUR du périmètre ; la valeur (commune / département) vient TOUJOURS
 * du token, jamais d'un paramètre client :
 *
 * <ul>
 *   <li>{@code TEPAC}           → sa commune          (claims « commune » + « dept »)</li>
 *   <li>{@code SUPERVISEUR_URD} → son département     (claim  « dept »)</li>
 *   <li>{@code ADMIN} / {@code DINEPA} → national     (aucun filtre)</li>
 *   <li>tout autre rôle         → rien (fail-closed)  — jamais de fuite par défaut</li>
 * </ul>
 *
 * <p>Un seul appel — {@link #resolve(Authentication)} — puis chaque contrôleur choisit la
 * requête repo correspondant au niveau. Pour les modules sans colonne commune (alertes /
 * tickets, dont le territoire est dérivé du point), le niveau {@code COMMUNE} est
 * volontairement vide tant que la dénormalisation n'est pas faite : fail-closed plutôt
 * qu'une fuite départementale (un TEPAC de Belle-Anse ne doit jamais voir Jacmel).
 */
@Component
public class TerritorialScope {

    public enum Niveau { NATIONAL, DEPARTEMENT, COMMUNE, AUCUN }

    /** Périmètre résolu : {@code departement} / {@code commune} non nuls selon le niveau. */
    public record Scope(Niveau niveau, String departement, String commune) {
        public boolean estNational()    { return niveau == Niveau.NATIONAL; }
        public boolean estDepartement() { return niveau == Niveau.DEPARTEMENT; }
        public boolean estCommune()     { return niveau == Niveau.COMMUNE; }
        public boolean estAucun()       { return niveau == Niveau.AUCUN; }
    }

    public Scope resolve(Authentication auth) {
        if (auth == null) return aucun();

        if (hasRole(auth, "ADMIN") || hasRole(auth, "DINEPA")) {
            return new Scope(Niveau.NATIONAL, null, null);
        }
        if (hasRole(auth, "SUPERVISEUR_URD")) {
            String dept = claim(auth, "dept");
            return notBlank(dept) ? new Scope(Niveau.DEPARTEMENT, dept, null) : aucun();
        }
        if (hasRole(auth, "TEPAC")) {
            String commune = claim(auth, "commune");
            String dept    = claim(auth, "dept");
            return notBlank(commune) ? new Scope(Niveau.COMMUNE, dept, commune) : aucun();
        }
        return aucun();
    }

    private static Scope aucun() { return new Scope(Niveau.AUCUN, null, null); }

    private static boolean hasRole(Authentication auth, String role) {
        String authority = "ROLE_" + role;
        for (GrantedAuthority ga : auth.getAuthorities()) {
            if (authority.equals(ga.getAuthority())) return true;
        }
        return false;
    }

    private static String claim(Authentication auth, String name) {
        return (auth.getPrincipal() instanceof Jwt jwt) ? jwt.getClaimAsString(name) : null;
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
