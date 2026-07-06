package com.example.api_metier.web;

import com.example.api_metier.domain.NotificationEntity;
import com.example.api_metier.domain.OuvrageEntity;
import com.example.api_metier.domain.OuvrageEtat;
import com.example.api_metier.domain.OuvrageType;
import com.example.api_metier.domain.OuvrageValidation;
import com.example.api_metier.domain.AlertSeverity;
import com.example.api_metier.repo.NotificationRepository;
import com.example.api_metier.repo.OuvrageRepository;
import com.example.api_metier.repo.UserProfileRepository;
import com.example.api_metier.service.AutoAlertService;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
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
 * Module Infrastructures (patrimoine bâti) — même cycle de validation que les Ressources :
 * le TEPAC SOUMET (statut EN_ATTENTE_VALIDATION, dept+commune imposés par le token), le
 * superviseur d'URD VALIDE/REJETTE. Périmètre dérivé du résolveur partagé {@link TerritorialScope} ;
 * territoire dénormalisé (colonnes department/commune) → scope sans jointure.
 */
@RestController
@RequestMapping("/api/ouvrages")
@PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD','OPERATOR','TEPAC')")
public class OuvrageController {

    private final OuvrageRepository ouvrages;
    private final TerritorialScope scope;
    private final UserProfileRepository profiles;
    private final NotificationRepository notifications;
    private final NotificationStream stream;
    private final AutoAlertService autoAlerts;

    public OuvrageController(OuvrageRepository ouvrages, TerritorialScope scope,
                             UserProfileRepository profiles, NotificationRepository notifications,
                             NotificationStream stream, AutoAlertService autoAlerts) {
        this.ouvrages      = ouvrages;
        this.scope         = scope;
        this.profiles      = profiles;
        this.notifications = notifications;
        this.stream        = stream;
        this.autoAlerts    = autoAlerts;
    }

    // ── Boucle métier : un ouvrage OFFICIEL en PANNE émet une alerte critique auto. ──
    private void emettreAlerteSiPanne(OuvrageEntity o) {
        if (o.getEtat() != OuvrageEtat.PANNE) return;
        autoAlerts.emit(
                "OUV-" + o.getId(),
                "OUVRAGE_PANNE",
                AlertSeverity.CRIT,
                o.getNom() + " — ouvrage en panne",
                o.getDepartment(), o.getCommune(), null);
    }

    // ── Liste (scopée ou nationale) ────────────────────────────────────────
    @GetMapping
    public List<OuvrageResponse> list(@RequestParam(required = false) String departementId, Authentication auth) {
        TerritorialScope.Scope s = scope.resolve(auth);
        List<OuvrageEntity> rows;
        switch (s.niveau()) {
            case NATIONAL:
                rows = (departementId != null && !departementId.isBlank())
                        ? ouvrages.findByDepartmentIgnoreCase(departementId) : ouvrages.findAll();
                break;
            case DEPARTEMENT:
                rows = ouvrages.findByDepartmentIgnoreCase(s.departement());
                break;
            case COMMUNE:
                // TEPAC : ouvrages officiels de sa commune ET ses propres soumissions (en attente / rejetées).
                rows = (s.commune() != null) ? ouvrages.findByCommuneIgnoreCase(s.commune()) : List.of();
                break;
            case AUCUN:
            default:
                rows = List.of();
        }
        return rows.stream().map(this::toResponse).toList();
    }

    // ── Création / soumission ───────────────────────────────────────────────
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public OuvrageResponse create(@RequestBody CreateOuvrageRequest req, Authentication auth) {
        if (req.nom() == null || req.nom().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom est requis");
        }
        if (req.type() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le type est requis");
        }

        TerritorialScope.Scope s = scope.resolve(auth);
        boolean soumissionTepac = s.estCommune();   // TEPAC : soumission à valider, périmètre fin

        // Le périmètre d'écriture vient TOUJOURS du token, jamais du payload.
        final String department;
        final String commune;
        final OuvrageValidation statut;
        if (soumissionTepac) {
            if (s.departement() == null || s.departement().isBlank()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Périmètre TEPAC incomplet (département absent du token)");
            }
            department = s.departement();
            commune    = s.commune();                // commune verrouillée sur celle du token
            statut     = OuvrageValidation.EN_ATTENTE_VALIDATION;
        } else {
            if (req.department() == null || req.department().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le département est requis");
            }
            if (SecurityScope.isSupervisor(auth)) {
                String dept = SecurityScope.tokenDept(auth);
                if (dept == null || !dept.equalsIgnoreCase(req.department().trim())) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Hors de votre périmètre départemental (" + dept + ")");
                }
            }
            department = req.department().trim();
            commune    = req.commune();
            statut     = OuvrageValidation.VALIDEE;
        }

        if (req.code() != null && !req.code().isBlank() && ouvrages.existsByCode(req.code().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Le code « " + req.code() + " » existe déjà");
        }

        String createdBy = (auth != null) ? auth.getName() : req.createdBy();
        OuvrageEntity entity = new OuvrageEntity(
                req.id(), req.code(), req.nom().trim(), req.type(), req.etat(),
                department, commune, req.section(), req.locality(), req.lat(), req.lon(),
                req.capaciteM3h(), req.anneeConstruction(), req.resourceId(), req.resourceName(),
                req.notes(), createdBy);
        entity.setStatut(statut);
        OuvrageEntity saved = ouvrages.save(entity);

        // Fan-out : une soumission TEPAC notifie ceux qui ont autorité de validation sur le dept.
        if (soumissionTepac) {
            List<String> cibles = profiles.validateursDuDept(department, createdBy == null ? "" : createdBy);
            Instant now = Instant.now();
            String titre = "Infrastructure à valider — " + (commune != null ? commune : department);
            String corps = saved.getNom() + " · " + saved.getType() + (commune != null ? " · " + commune : "");
            for (String username : cibles) {
                NotificationEntity n = notifications.save(new NotificationEntity(
                        username, "OUVRAGE_ATTENTE", titre, corps, null, commune, now));
                stream.push(username, NotificationStream.payload(n.getId(), titre, null));
            }
        } else {
            // Ouvrage officiel (superviseur/admin) déclaré d'emblée en panne → alerte auto.
            // Une soumission TEPAC (EN_ATTENTE) n'émet qu'à la VALIDATION.
            emettreAlerteSiPanne(saved);
        }

        return toResponse(saved);
    }

    // ── Validation (superviseur d'URD) ──────────────────────────────────────
    @PatchMapping("/{id}/valider")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD')")
    @Transactional
    public OuvrageResponse valider(@PathVariable("id") String id, Authentication auth) {
        OuvrageEntity o = chargerPourDecision(id, auth);
        o.valider(auth != null ? auth.getName() : "system", Instant.now());
        ouvrages.save(o);
        notifierCreateur(o, "OUVRAGE_VALIDEE", "Infrastructure validée — " + o.getNom(),
                o.getNom() + " est désormais officielle dans le patrimoine.");
        // Une fois OFFICIEL, un ouvrage en panne déclenche l'alerte métier.
        emettreAlerteSiPanne(o);
        return toResponse(o);
    }

    @PatchMapping("/{id}/rejeter")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD')")
    @Transactional
    public OuvrageResponse rejeter(@PathVariable("id") String id, @RequestBody DecisionRequest body, Authentication auth) {
        if (body == null || body.motif() == null || body.motif().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un motif de rejet est requis");
        }
        OuvrageEntity o = chargerPourDecision(id, auth);
        o.rejeter(auth != null ? auth.getName() : "system", Instant.now(), body.motif().trim());
        ouvrages.save(o);
        notifierCreateur(o, "OUVRAGE_REJETEE", "Infrastructure rejetée — " + o.getNom(),
                "Motif : " + body.motif().trim());
        return toResponse(o);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private OuvrageEntity chargerPourDecision(String id, Authentication auth) {
        OuvrageEntity o = ouvrages.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ouvrage introuvable"));
        if (SecurityScope.isSupervisor(auth)) {
            String tokenDept = SecurityScope.tokenDept(auth);
            if (tokenDept == null || o.getDepartment() == null || !tokenDept.equalsIgnoreCase(o.getDepartment())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Hors de votre périmètre départemental (" + tokenDept + ")");
            }
        }
        return o;
    }

    private void notifierCreateur(OuvrageEntity o, String type, String titre, String corps) {
        if (o.getCreatedBy() == null || o.getCreatedBy().isBlank() || "seed".equals(o.getCreatedBy())) return;
        Instant now = Instant.now();
        NotificationEntity n = notifications.save(new NotificationEntity(
                o.getCreatedBy(), type, titre, corps, null, o.getCommune(), now));
        stream.push(o.getCreatedBy(), NotificationStream.payload(n.getId(), titre, null));
    }

    private OuvrageResponse toResponse(OuvrageEntity o) {
        return new OuvrageResponse(
                o.getId(), o.getCode(), o.getNom(), o.getType(), o.getEtat(),
                o.getDepartment(), o.getCommune(), o.getSection(), o.getLocality(),
                o.getLat(), o.getLon(), o.getCapaciteM3h(), o.getAnneeConstruction(),
                o.getResourceId(), o.getResourceName(), o.getNotes(),
                o.getStatut(), o.getCreatedBy(), o.getValidatedBy(),
                o.getValidatedAt() != null ? o.getValidatedAt().toString() : null, o.getMotifRejet(),
                o.getCreatedAt() != null ? o.getCreatedAt().toString() : null);
    }

    // ── Records ───────────────────────────────────────────────────────────

    public record CreateOuvrageRequest(
            String id, String code, String nom, OuvrageType type, OuvrageEtat etat,
            String department, String commune, String section, String locality,
            Double lat, Double lon, Double capaciteM3h, Integer anneeConstruction,
            String resourceId, String resourceName, String notes, String createdBy
    ) {}

    public record DecisionRequest(String motif) {}

    public record OuvrageResponse(
            String id, String code, String nom, OuvrageType type, OuvrageEtat etat,
            String department, String commune, String section, String locality,
            Double lat, Double lon, Double capaciteM3h, Integer anneeConstruction,
            String resourceId, String resourceName, String notes,
            OuvrageValidation statut, String createdBy, String validatedBy, String validatedAt, String motifRejet,
            String createdAt
    ) {}
}
