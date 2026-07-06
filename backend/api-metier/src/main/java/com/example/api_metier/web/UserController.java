package com.example.api_metier.web;

import com.example.api_metier.domain.UserAccountEntity;
import com.example.api_metier.domain.UserProfileEntity;
import com.example.api_metier.repo.UserAccountRepository;
import com.example.api_metier.repo.UserProfileRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD','OPERATOR')")
public class UserController {

    private final UserAccountRepository accounts;
    private final UserProfileRepository profiles;
    private final PasswordEncoder passwordEncoder;
    private final TerritorialScope scope;

    public UserController(UserAccountRepository accounts,
                          UserProfileRepository profiles,
                          PasswordEncoder passwordEncoder,
                          TerritorialScope scope) {
        this.accounts        = accounts;
        this.profiles        = profiles;
        this.passwordEncoder = passwordEncoder;
        this.scope           = scope;
    }

    /**
     * Crée l'utilisateur complet : compte auth + profil métier en une seule transaction.
     * Valide l'unicité de username, email et téléphone avant d'écrire.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    public UserProfileResponse createUser(@RequestBody CreateUserRequest req) {
        String username = req.username().trim().toLowerCase();

        if (username.isBlank() || req.password() == null || req.password().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Identifiant et mot de passe requis");
        }
        if (accounts.existsById(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "L'identifiant « " + username + " » est déjà utilisé");
        }
        // Email normalisé en minuscules : le login résout via findByEmailIgnoreCase, donc la
        // déduplication doit l'être aussi (sinon « A@x » et « a@x » coexistent → login ambigu).
        String email = (req.email() != null && !req.email().isBlank()) ? req.email().trim().toLowerCase() : null;
        if (email != null && profiles.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "L'adresse email est déjà associée à un compte");
        }
        if (req.telephone() != null && !req.telephone().isBlank() && profiles.existsByTelephone(req.telephone().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce numéro de téléphone est déjà utilisé");
        }

        // Rôle Spring Security (défaut : superviseur d'URD)
        String springRole = req.role() != null ? toSpringRole(req.role()) : "SUPERVISEUR_URD";

        // Dériver les initiales
        String nom = (req.nom() != null) ? req.nom().trim() : username;
        String initiales = initiales(nom);

        // Persister le compte d'authentification
        UserAccountEntity account = new UserAccountEntity(
                username, passwordEncoder.encode(req.password()), springRole, true);
        accounts.save(account);

        // Persister le profil complet
        UserProfileEntity profile = new UserProfileEntity(
                username, nom,
                email,
                req.telephone() != null ? req.telephone().trim() : null,
                req.fonction(),
                req.role() != null ? req.role() : "superviseur_urd",
                initiales,
                req.urdId(), req.orepa(), req.dept(),
                req.permissions(),
                req.createdBy()
        );
        profiles.save(profile);

        return toResponse(profile);
    }

    /**
     * Annuaire des personnes, PÉRIMÈTRE IMPOSÉ PAR LE TOKEN (résolveur partagé) — un superviseur
     * ne reçoit que les personnes de son département, un TEPAC que sa commune, l'admin le national
     * (drill-down optionnel par {@code urdId}). Plus de liste globale renvoyée à un superviseur.
     * C'est la source unique des « personnes / techniciens » lue par le tableau de bord.
     */
    @GetMapping
    public List<UserProfileResponse> listUsers(@RequestParam(required = false) String urdId, Authentication auth) {
        TerritorialScope.Scope s = scope.resolve(auth);
        List<UserProfileEntity> list;
        switch (s.niveau()) {
            case NATIONAL:
                list = (urdId != null && !urdId.isBlank())
                        ? profiles.findByUrdId(urdId)
                        : profiles.findByStatutNot("archive");
                break;
            case DEPARTEMENT:
                list = profiles.findByDeptIgnoreCaseAndStatutNot(s.departement(), "archive");
                break;
            case COMMUNE:
                list = (s.commune() != null)
                        ? profiles.findByCommuneIgnoreCaseAndStatutNot(s.commune(), "archive")
                        : List.of();
                break;
            case AUCUN:
            default:
                list = List.of();
        }
        return list.stream().map(this::toResponse).toList();
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private String toSpringRole(String role) {
        return switch (role) {
            case "admin_orepa", "admin_dinepa", "Admin OREPA", "Admin DINEPA" -> "ADMIN";
            case "superviseur_urd", "Responsable URD", "responsable_urd" -> "SUPERVISEUR_URD";
            default -> "OPERATOR";
        };
    }

    private String initiales(String nom) {
        String[] parts = nom.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < Math.min(parts.length, 2); i++) {
            if (!parts[i].isEmpty()) sb.append(parts[i].charAt(0));
        }
        return sb.toString().toUpperCase();
    }

    private UserProfileResponse toResponse(UserProfileEntity p) {
        return new UserProfileResponse(
                p.getUsername(), p.getNom(), p.getEmail(), p.getTelephone(),
                p.getFonction(), p.getRole(), p.getInitiales(),
                p.getUrdId(), p.getOrepa(), p.getDept(), p.getCommune(),
                p.getPermissions(), p.getStatut(),
                p.getCreatedAt() != null ? p.getCreatedAt().toString() : null
        );
    }

    // ── Records ──────────────────────────────────────────────────────────

    public record CreateUserRequest(
            String username, String password,
            String nom, String email, String telephone, String fonction,
            String role, String urdId, String orepa, String dept,
            String permissions, String createdBy
    ) {}

    public record UserProfileResponse(
            String username, String nom, String email, String telephone,
            String fonction, String role, String initiales,
            String urdId, String orepa, String dept, String commune,
            String permissions, String statut, String createdAt
    ) {}
}
