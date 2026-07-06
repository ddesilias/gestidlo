package com.example.api_metier.web;

import com.example.api_metier.domain.NotificationEntity;
import com.example.api_metier.domain.RessourceDepartementEntity;
import com.example.api_metier.domain.RessourceEntity;
import com.example.api_metier.domain.RessourceEtat;
import com.example.api_metier.domain.RessourceStatut;
import com.example.api_metier.domain.RessourceType;
import com.example.api_metier.domain.AlertSeverity;
import com.example.api_metier.repo.NotificationRepository;
import com.example.api_metier.repo.RessourceDepartementRepository;
import com.example.api_metier.repo.RessourceRepository;
import com.example.api_metier.repo.UserProfileRepository;
import com.example.api_metier.service.AutoAlertService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
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
 * Module Ressources naturelles — un seul endpoint, deux portées.
 * Sans {@code departementId} : vue nationale (toutes les ressources, chaque ressource
 * comptée une fois). Avec {@code departementId} : vue scopée à l'URD via la liaison N–N.
 *
 * <p>Le débit est imputé via {@code quotePartDebit} (somme nationale exacte même si une
 * rivière traverse plusieurs départements). Le patrimoine/menace est compté au
 * département principal pour éviter le double comptage.
 */
@RestController
@RequestMapping("/api/ressources")
@PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD','OPERATOR','TEPAC')")
public class RessourceController {

    private final RessourceRepository ressources;
    private final RessourceDepartementRepository liens;
    private final TerritorialScope scope;
    private final UserProfileRepository profiles;
    private final NotificationRepository notifications;
    private final NotificationStream stream;
    private final AutoAlertService autoAlerts;

    public RessourceController(RessourceRepository ressources,
                               RessourceDepartementRepository liens,
                               TerritorialScope scope,
                               UserProfileRepository profiles,
                               NotificationRepository notifications,
                               NotificationStream stream,
                               AutoAlertService autoAlerts) {
        this.ressources    = ressources;
        this.liens         = liens;
        this.scope         = scope;
        this.profiles      = profiles;
        this.notifications = notifications;
        this.stream        = stream;
        this.autoAlerts    = autoAlerts;
    }

    // ── Boucle métier : une ressource POLLUÉE/MENACÉE OFFICIELLE émet une alerte auto. ──
    private void emettreAlerteSiCritique(RessourceEntity r, String dept) {
        RessourceEtat etat = r.getEtat();
        if (etat != RessourceEtat.POLLUEE && etat != RessourceEtat.MENACEE) return;
        boolean polluee = etat == RessourceEtat.POLLUEE;
        autoAlerts.emit(
                "RES-" + r.getId(),
                polluee ? "RESSOURCE_POLLUEE" : "RESSOURCE_MENACEE",
                polluee ? AlertSeverity.CRIT : AlertSeverity.WARN,
                r.getNom() + " — ressource " + (polluee ? "polluée" : "menacée"),
                dept, r.getCommune(), r.getId());
    }

    // ── Liste (scopée ou nationale) ────────────────────────────────────────
    @GetMapping
    public List<RessourceResponse> list(@RequestParam(required = false) String departementId, Authentication auth) {
        // Périmètre imposé par le token (résolveur partagé). Ressource = patrimoine départemental
        // (liaison N–N) : pas de portée commune → niveau COMMUNE fail-closed.
        TerritorialScope.Scope s = scope.resolve(auth);
        List<RessourceEntity> rows;
        switch (s.niveau()) {
            case NATIONAL:
                rows = (departementId != null && !departementId.isBlank()) ? scopedRessources(departementId) : ressources.findAll();
                break;
            case DEPARTEMENT:
                rows = scopedRessources(s.departement());
                break;
            case COMMUNE:
                // TEPAC : périmètre fin commune (colonne dénormalisée). Il voit les ressources
                // officielles de sa commune ET ses propres recensements (en attente / rejetés).
                rows = (s.commune() != null) ? ressources.findByCommuneIgnoreCase(s.commune()) : List.of();
                break;
            case AUCUN:
            default:
                rows = List.of();
        }
        return rows.stream().map(this::toResponse).toList();
    }

    // ── KPI (scopés ou nationaux) ──────────────────────────────────────────
    @GetMapping("/kpi")
    public KpiResponse kpi(@RequestParam(required = false) String departementId, Authentication auth) {
        TerritorialScope.Scope s = scope.resolve(auth);
        if (s.estAucun() || s.estCommune()) {
            return new KpiResponse(0, 0, 0);   // pas de KPI ressources hors portée départementale
        }
        String dept = s.estDepartement()
                ? s.departement()
                : (departementId != null && !departementId.isBlank() ? departementId : null);
        if (dept != null) {
            List<RessourceDepartementEntity> links = liens.findByIdDepartementId(dept);
            Map<String, RessourceEntity> byId = byId(
                    links.stream().map(RessourceDepartementEntity::getRessourceId).collect(Collectors.toSet()));

            int patrimoine = 0, menace = 0;
            double debit = 0;
            for (RessourceDepartementEntity l : links) {
                RessourceEntity r = byId.get(l.getRessourceId());
                if (r == null) continue;
                debit += (r.getDebitM3h() != null ? r.getDebitM3h() : 0) * l.getQuotePartDebit();
                if (l.isEstPrincipal()) {
                    patrimoine++;
                    if (r.getEtat() == RessourceEtat.MENACEE || r.getEtat() == RessourceEtat.POLLUEE) menace++;
                }
            }
            return new KpiResponse(patrimoine, round(debit), menace);
        }

        // National : chaque ressource compte une fois.
        List<RessourceEntity> all = ressources.findAll();
        int patrimoine = all.size();
        int menace = (int) all.stream()
                .filter(r -> r.getEtat() == RessourceEtat.MENACEE || r.getEtat() == RessourceEtat.POLLUEE)
                .count();
        double debit = all.stream().mapToDouble(r -> r.getDebitM3h() != null ? r.getDebitM3h() : 0).sum();
        return new KpiResponse(patrimoine, round(debit), menace);
    }

    // ── Création (avec dérivation des liaisons départementales) ─────────────
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public RessourceResponse create(@RequestBody CreateRessourceRequest req, Authentication auth) {
        if (req.nom() == null || req.nom().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom est requis");
        }
        if (req.type() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le type est requis");
        }

        TerritorialScope.Scope s = scope.resolve(auth);
        boolean recensementTepac = s.estCommune();   // TEPAC : soumission à valider, périmètre fin

        // Le périmètre d'écriture vient TOUJOURS du token, jamais du payload.
        //  • TEPAC  : dept + commune imposés par le token ; la ressource entre EN_ATTENTE_VALIDATION.
        //  • Superv.: prélèvement borné à son département (contrôle sur le dept PRINCIPAL — une rivière
        //             peut légitimement traverser d'autres dépts) ; la ressource est VALIDEE d'office.
        final String principal;
        final String commune;
        final RessourceStatut statut;
        if (recensementTepac) {
            if (s.departement() == null || s.departement().isBlank()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Périmètre TEPAC incomplet (département absent du token)");
            }
            principal = s.departement();
            commune   = s.commune();                 // commune verrouillée sur celle du token
            statut    = RessourceStatut.EN_ATTENTE_VALIDATION;
        } else {
            if (req.departementPrincipal() == null || req.departementPrincipal().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le département de prélèvement est requis");
            }
            if (SecurityScope.isSupervisor(auth)) {
                String dept = SecurityScope.tokenDept(auth);
                if (dept == null || !dept.equalsIgnoreCase(req.departementPrincipal().trim())) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                            "Hors de votre périmètre départemental (" + dept + ")");
                }
            }
            principal = req.departementPrincipal().trim();
            commune   = req.commune();
            statut    = RessourceStatut.VALIDEE;
        }

        if (req.code() != null && !req.code().isBlank() && ressources.existsByCode(req.code().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Le code « " + req.code() + " » existe déjà");
        }

        String createdBy = (auth != null) ? auth.getName() : req.createdBy();
        RessourceEntity entity = new RessourceEntity(
                req.id(), req.code(), req.nom().trim(), req.type(), req.etat(),
                req.debitM3h(), req.lat(), req.lon(), commune, req.section(), createdBy);
        entity.setStatut(statut);
        RessourceEntity saved = ressources.save(entity);

        // Dérivation N–N : principal (quote=1) + départements traversés (quote=0 par défaut).
        Set<String> depts = new LinkedHashSet<>();
        depts.add(principal);
        if (!recensementTepac && req.departementsTraverses() != null) {
            for (String d : req.departementsTraverses()) {
                if (d != null && !d.isBlank()) depts.add(d.trim());
            }
        }
        for (String d : depts) {
            boolean isPrincipal = d.equals(principal);
            liens.save(new RessourceDepartementEntity(
                    saved.getId(), d, isPrincipal, isPrincipal ? 1.0 : 0.0));
        }

        // Fan-out : un recensement TEPAC notifie ceux qui ont autorité de validation sur le dept
        // (admins + superviseurs de l'URD) — inverse du read-scope, restreint aux validateurs.
        if (recensementTepac) {
            List<String> cibles = profiles.validateursDuDept(principal, createdBy == null ? "" : createdBy);
            Instant now = Instant.now();
            String titre = "Recensement à valider — " + (commune != null ? commune : principal);
            String corps = saved.getNom() + " · " + saved.getType() + (commune != null ? " · " + commune : "");
            for (String username : cibles) {
                NotificationEntity n = notifications.save(new NotificationEntity(
                        username, "RESSOURCE_ATTENTE", titre, corps, null, commune, now));
                stream.push(username, NotificationStream.payload(n.getId(), titre, null));
            }
        } else {
            // Ressource officielle (superviseur/admin) déclarée d'emblée polluée/menacée → alerte auto.
            // Un recensement TEPAC (EN_ATTENTE) n'émet pas encore : l'alerte naît à la VALIDATION.
            emettreAlerteSiCritique(saved, principal);
        }

        return toResponse(saved);
    }

    // ── Validation (superviseur d'URD : valide ou rejette un recensement) ────

    @PatchMapping("/{id}/valider")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD')")
    @Transactional
    public RessourceResponse valider(@PathVariable("id") String id, Authentication auth) {
        RessourceEntity r = chargerPourDecision(id, auth);
        r.valider(auth != null ? auth.getName() : "system", Instant.now());
        ressources.save(r);
        notifierCreateur(r, "RESSOURCE_VALIDEE", "Recensement validé — " + r.getNom(),
                r.getNom() + " est désormais officielle dans le patrimoine.");
        // Une fois OFFICIELLE, une ressource polluée/menacée déclenche l'alerte métier.
        emettreAlerteSiCritique(r, deptPrincipal(r.getId()));
        return toResponse(r);
    }

    @PatchMapping("/{id}/rejeter")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD')")
    @Transactional
    public RessourceResponse rejeter(@PathVariable("id") String id, @RequestBody DecisionRequest body, Authentication auth) {
        if (body == null || body.motif() == null || body.motif().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un motif de rejet est requis");
        }
        RessourceEntity r = chargerPourDecision(id, auth);
        r.rejeter(auth != null ? auth.getName() : "system", Instant.now(), body.motif().trim());
        ressources.save(r);
        notifierCreateur(r, "RESSOURCE_REJETEE", "Recensement rejeté — " + r.getNom(),
                "Motif : " + body.motif().trim());
        return toResponse(r);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private List<RessourceEntity> scopedRessources(String departementId) {
        Set<String> ids = liens.findByIdDepartementId(departementId).stream()
                .map(RessourceDepartementEntity::getRessourceId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        return ressources.findAllById(ids);
    }

    private Map<String, RessourceEntity> byId(Set<String> ids) {
        return ressources.findAllById(ids).stream()
                .collect(Collectors.toMap(RessourceEntity::getId, Function.identity()));
    }

    /** Charge la ressource pour décision et vérifie l'autorité départementale du superviseur. */
    private RessourceEntity chargerPourDecision(String id, Authentication auth) {
        RessourceEntity r = ressources.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ressource introuvable"));
        if (SecurityScope.isSupervisor(auth)) {
            String tokenDept = SecurityScope.tokenDept(auth);
            String deptRes = deptPrincipal(r.getId());
            if (tokenDept == null || deptRes == null || !tokenDept.equalsIgnoreCase(deptRes)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Hors de votre périmètre départemental (" + tokenDept + ")");
            }
        }
        return r;
    }

    /** Département principal (point de prélèvement) d'une ressource via la liaison N–N. */
    private String deptPrincipal(String ressourceId) {
        return liens.findByIdRessourceId(ressourceId).stream()
                .filter(RessourceDepartementEntity::isEstPrincipal)
                .map(RessourceDepartementEntity::getDepartementId)
                .findFirst().orElse(null);
    }

    /** Notifie l'auteur du recensement (le TEPAC) de la décision du superviseur. */
    private void notifierCreateur(RessourceEntity r, String type, String titre, String corps) {
        if (r.getCreatedBy() == null || r.getCreatedBy().isBlank() || "seed".equals(r.getCreatedBy())) return;
        Instant now = Instant.now();
        NotificationEntity n = notifications.save(new NotificationEntity(
                r.getCreatedBy(), type, titre, corps, null, r.getCommune(), now));
        stream.push(r.getCreatedBy(), NotificationStream.payload(n.getId(), titre, null));
    }

    private RessourceResponse toResponse(RessourceEntity r) {
        List<RessourceDepartementDto> depts = new ArrayList<>();
        for (RessourceDepartementEntity l : liens.findByIdRessourceId(r.getId())) {
            depts.add(new RessourceDepartementDto(l.getDepartementId(), l.isEstPrincipal(), l.getQuotePartDebit()));
        }
        return new RessourceResponse(
                r.getId(), r.getCode(), r.getNom(), r.getType(), r.getEtat(),
                r.getDebitM3h(), r.getLat(), r.getLon(), r.getCommune(), r.getSection(),
                depts, r.getStatut(), r.getCreatedBy(), r.getValidatedBy(),
                r.getValidatedAt() != null ? r.getValidatedAt().toString() : null, r.getMotifRejet(),
                r.getCreatedAt() != null ? r.getCreatedAt().toString() : null);
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    // ── Records ───────────────────────────────────────────────────────────

    public record CreateRessourceRequest(
            String id, String code, String nom, RessourceType type, RessourceEtat etat,
            Double debitM3h, Double lat, Double lon, String commune, String section,
            String departementPrincipal, List<String> departementsTraverses, String createdBy
    ) {}

    public record DecisionRequest(String motif) {}

    public record RessourceDepartementDto(
            String departementId, boolean estPrincipal, double quotePartDebit
    ) {}

    public record RessourceResponse(
            String id, String code, String nom, RessourceType type, RessourceEtat etat,
            Double debitM3h, Double lat, Double lon, String commune, String section,
            List<RessourceDepartementDto> departements,
            RessourceStatut statut, String createdBy, String validatedBy, String validatedAt, String motifRejet,
            String createdAt
    ) {}

    public record KpiResponse(int patrimoine, double debitM3h, int menace) {}
}
