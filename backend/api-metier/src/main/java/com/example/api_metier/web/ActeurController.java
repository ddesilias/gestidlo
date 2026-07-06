package com.example.api_metier.web;

import com.example.api_metier.domain.ActeurEntity;
import com.example.api_metier.domain.ActeurType;
import com.example.api_metier.domain.UserAccountEntity;
import com.example.api_metier.domain.UserProfileEntity;
import com.example.api_metier.repo.ActeurRepository;
import com.example.api_metier.repo.UserAccountRepository;
import com.example.api_metier.repo.UserProfileRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Acteurs de la gouvernance de l'eau, scopés au département.
 * GET (?departementId) : annuaire scopé. POST : enregistrement avec garde-fous serveur —
 * (1) périmètre revérifié contre le profil du caller, (2) unicité métier (un TEPAC /
 * une mairie par commune) renvoyée en 422 avec message affiché par le front.
 * Pour un TEPAC, un compte de connexion (role tepac) peut être créé dans la même
 * transaction et lié à l'acteur via {@code compteUsername}.
 */
@RestController
@RequestMapping("/api/acteurs")
@PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD','OPERATOR')")
public class ActeurController {

    private final ActeurRepository acteurs;
    private final UserProfileRepository profiles;
    private final UserAccountRepository accounts;
    private final PasswordEncoder passwordEncoder;
    private final TerritorialScope scope;

    public ActeurController(ActeurRepository acteurs, UserProfileRepository profiles,
                            UserAccountRepository accounts, PasswordEncoder passwordEncoder,
                            TerritorialScope scope) {
        this.acteurs         = acteurs;
        this.profiles        = profiles;
        this.accounts        = accounts;
        this.passwordEncoder = passwordEncoder;
        this.scope           = scope;
    }

    @GetMapping
    public List<ActeurResponse> list(@RequestParam(required = false) String departementId, Authentication auth) {
        // Périmètre imposé par le token (résolveur partagé). L'acteur porte departementId + commune.
        TerritorialScope.Scope s = scope.resolve(auth);
        List<ActeurEntity> rows;
        switch (s.niveau()) {
            case NATIONAL:
                rows = (departementId != null && !departementId.isBlank())
                        ? acteurs.findByDepartementIdAndSupprimeLeIsNull(departementId)
                        : acteurs.findBySupprimeLeIsNull();
                break;
            case DEPARTEMENT:
                rows = acteurs.findByDepartementIdAndSupprimeLeIsNull(s.departement());
                break;
            case COMMUNE:
                rows = acteurs.findByDepartementIdAndCommuneIgnoreCaseAndSupprimeLeIsNull(s.departement(), s.commune());
                break;
            case AUCUN:
            default:
                rows = List.of();
        }
        return rows.stream().map(this::toResponse).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ActeurResponse create(@RequestBody CreateActeurRequest req, Authentication auth) {
        if (req.type() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le type d'acteur est requis");
        }
        if (req.nom() == null || req.nom().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom est requis");
        }
        if (req.departementId() == null || req.departementId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le département est requis");
        }

        // Garde-fou périmètre : un superviseur ne peut écrire que dans son département.
        if (auth != null) {
            UserProfileEntity profile = profiles.findById(auth.getName()).orElse(null);
            if (profile != null && profile.getDept() != null && !profile.getDept().isBlank()
                    && !profile.getDept().equalsIgnoreCase(req.departementId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Hors de votre périmètre départemental (" + profile.getDept() + ")");
            }
        }

        // TEPAC et mairie : la commune est requise. L'unicité n'est imposée QUE pour la
        // mairie (une commune n'a qu'un hôtel de ville) ; une commune peut compter
        // PLUSIEURS TEPAC — plusieurs relais/techniciens de terrain s'y partagent le suivi.
        if (req.type() == ActeurType.TEPAC || req.type() == ActeurType.MAIRIE) {
            if (req.commune() == null || req.commune().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La commune est requise pour ce type");
            }
            if (req.type() == ActeurType.MAIRIE
                    && acteurs.existsByTypeAndDepartementIdAndCommuneIgnoreCaseAndSupprimeLeIsNull(
                            ActeurType.MAIRIE, req.departementId(), req.commune())) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "Une mairie est déjà enregistrée pour la commune « " + req.commune() + " »");
            }
        }

        // Enregistrer un TEPAC crée DEUX choses dans la même transaction :
        //  (1) l'acteur terrain (ci-dessous), (2) un compte de connexion. Le login se fait
        //  par EMAIL (résolu vers le username via user_profiles), le rôle est TEPAC (exigé
        //  par le shell /terrain), et le mot de passe temporaire est HACHÉ (BCrypt), jamais
        //  stocké en clair. Le périmètre du technicien = commune + département.
        String compteUsername = null;
        if (req.type() == ActeurType.TEPAC) {
            String email      = blankToNull(req.compteEmail());
            String motDePasse = req.comptePassword() != null ? req.comptePassword().trim() : "";
            if (email == null || motDePasse.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Email et mot de passe temporaire requis pour enregistrer un TEPAC");
            }
            email = email.toLowerCase();
            if (profiles.existsByEmail(email)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "L'adresse email « " + email + " » est déjà associée à un compte");
            }
            String tel = blankToNull(req.contactTel());
            if (tel != null && profiles.existsByTelephone(tel)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Ce numéro de téléphone est déjà utilisé");
            }
            String username = deriveUsername(email);
            // (2a) compte d'authentification — rôle TEPAC, mot de passe haché.
            accounts.save(new UserAccountEntity(
                    username, passwordEncoder.encode(motDePasse), "TEPAC", true));
            // (2b) profil métier — source unique des claims : email (login), commune/dept (scope).
            UserProfileEntity profile = new UserProfileEntity(
                    username, req.nom().trim(), email, tel,
                    "Technicien TEPAC — commune " + req.commune(), "tepac", initiales(req.nom()),
                    null, null, req.departementId(), "recenser,ouvrages",
                    auth != null ? auth.getName() : null);
            profile.setCommune(req.commune());
            profiles.save(profile);
            compteUsername = username;
        }

        ActeurEntity entity = new ActeurEntity(
                req.id(), req.type(), req.nom().trim(), req.departementId(),
                blankToNull(req.commune()), blankToNull(req.sousType()), blankToNull(req.maitreOuvrage()),
                blankToNull(req.typeContrat()), req.periodeDebut(), req.periodeFin(),
                blankToNull(req.ouvrageIds()), blankToNull(req.zoneId()), blankToNull(req.responsable()),
                blankToNull(req.contactTel()), req.statut(),
                auth != null ? auth.getName() : null);
        entity.setCompteUsername(compteUsername);

        return toResponse(acteurs.save(entity));
    }

    /** Archivage (soft-delete : supprime_le = now), jamais d'effacement physique. La ligne
     * reste auditable. Admin partout ; superviseur uniquement dans SON département. Si un
     * compte de connexion est lié (TEPAC), il est désactivé pour couper l'accès terrain. */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD')")
    @Transactional
    public void delete(@PathVariable String id, Authentication auth) {
        ActeurEntity a = acteurs.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Acteur introuvable"));
        guardEcriture(a, auth);
        if (a.getSupprimeLe() == null) {
            a.setSupprimeLe(Instant.now());
            acteurs.save(a);
            majCompteLie(a, false);   // archivage → on coupe l'accès du compte lié
        }
    }

    /** Suspendre / réactiver un acteur. Admin partout ; superviseur dans SON département.
     * « suspendu » coupe l'accès du compte de connexion lié (TEPAC) ; « actif » le rétablit.
     * Réversible et auditable — à l'inverse de l'archivage qui retire l'acteur des listes. */
    @PatchMapping("/{id}/statut")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD')")
    @Transactional
    public ActeurResponse changerStatut(@PathVariable String id, @RequestBody StatutRequest req,
                                        Authentication auth) {
        String nouveau = req.statut() == null ? "" : req.statut().trim().toLowerCase();
        if (!nouveau.equals("actif") && !nouveau.equals("suspendu")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Statut invalide (actif | suspendu)");
        }
        ActeurEntity a = acteurs.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Acteur introuvable"));
        guardEcriture(a, auth);
        a.setStatut(nouveau);
        acteurs.save(a);
        majCompteLie(a, nouveau.equals("actif"));   // suspendu → compte coupé, actif → rétabli
        return toResponse(a);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /** Garde-fou écriture : un superviseur ne peut agir que dans son département.
     * (Un admin DINEPA a un dept nul/national → aucune restriction, comme au POST.) */
    private void guardEcriture(ActeurEntity a, Authentication auth) {
        if (auth == null) return;
        UserProfileEntity profile = profiles.findById(auth.getName()).orElse(null);
        if (profile != null && profile.getDept() != null && !profile.getDept().isBlank()
                && !profile.getDept().equalsIgnoreCase(a.getDepartementId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Hors de votre périmètre départemental (" + profile.getDept() + ")");
        }
    }

    /** Active/désactive le compte de connexion lié à l'acteur (TEPAC), s'il existe. */
    private void majCompteLie(ActeurEntity a, boolean actif) {
        if (a.getCompteUsername() == null) return;
        accounts.findById(a.getCompteUsername()).ifPresent(acc -> {
            acc.setActive(actif);
            accounts.save(acc);
        });
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    /** Username (clé d'auth) dérivé de l'email : partie locale réduite à [a-z0-9], rendue unique. */
    private String deriveUsername(String email) {
        String base = email.split("@")[0].toLowerCase().replaceAll("[^a-z0-9]", "");
        if (base.isBlank()) base = "tepac";
        if (base.length() > 70) base = base.substring(0, 70);
        String candidate = base;
        int i = 1;
        while (accounts.existsById(candidate)) {
            candidate = base + (++i);
        }
        return candidate;
    }

    private static String initiales(String nom) {
        String[] parts = (nom == null ? "" : nom.trim()).split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < Math.min(parts.length, 2); i++) {
            if (!parts[i].isEmpty()) sb.append(parts[i].charAt(0));
        }
        return sb.toString().toUpperCase();
    }

    private ActeurResponse toResponse(ActeurEntity a) {
        return new ActeurResponse(
                a.getId(), a.getType(), a.getNom(), a.getDepartementId(),
                a.getCommune(), a.getSousType(), a.getMaitreOuvrage(), a.getTypeContrat(),
                a.getPeriodeDebut(), a.getPeriodeFin(), a.getOuvrageIds(), a.getZoneId(),
                a.getResponsable(), a.getContactTel(), a.getCompteUsername(), a.getStatut(),
                a.getCreatedAt() != null ? a.getCreatedAt().toString() : null);
    }

    // ── Records ──────────────────────────────────────────────────────────────

    public record StatutRequest(String statut) {}

    public record CreateActeurRequest(
            String id, ActeurType type, String nom, String departementId,
            String commune, String sousType, String maitreOuvrage, String typeContrat,
            Integer periodeDebut, Integer periodeFin, String ouvrageIds, String zoneId,
            String responsable, String contactTel, String statut,
            String compteUsername, String comptePassword, String compteEmail
    ) {}

    public record ActeurResponse(
            String id, ActeurType type, String nom, String departementId,
            String commune, String sousType, String maitreOuvrage, String typeContrat,
            Integer periodeDebut, Integer periodeFin, String ouvrageIds, String zoneId,
            String responsable, String contactTel, String compteUsername, String statut, String createdAt
    ) {}
}
