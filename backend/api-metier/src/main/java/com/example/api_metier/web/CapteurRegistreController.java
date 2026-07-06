package com.example.api_metier.web;

import com.example.api_metier.domain.CapteurEntity;
import com.example.api_metier.domain.CapteurType;
import com.example.api_metier.domain.CapteurValidation;
import com.example.api_metier.domain.NotificationEntity;
import com.example.api_metier.domain.OuvrageEntity;
import com.example.api_metier.repo.CapteurRepository;
import com.example.api_metier.repo.NotificationRepository;
import com.example.api_metier.repo.OuvrageRepository;
import com.example.api_metier.repo.UserProfileRepository;
import java.time.Duration;
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
 * Registre des capteurs IoT + cycle de validation (déclaration TEPAC → décision superviseur),
 * même logique que Ressources/Infrastructures. Distinct de {@link CapteurController} (vue dérivée
 * des points pour la carte) : ici le capteur est une ENTITÉ déclarée. État DÉRIVÉ live depuis
 * {@code lastValue}/{@code lastSeen} (alimentés par l'ingestion temps réel HTTP corrélée par code) :
 *   - statut non validé → « en-attente » / « rejete »
 *   - validé + mesure fraîche → « critique » / « attention » / « en-ligne » (seuils par type)
 *   - validé + mesure périmée ou absente → « hors-ligne »
 */
@RestController
@RequestMapping("/api/iot/capteurs")
@PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD','OPERATOR','TEPAC')")
public class CapteurRegistreController {

    private static final Duration FRESH = Duration.ofMinutes(5);

    private final CapteurRepository capteurs;
    private final TerritorialScope scope;
    private final UserProfileRepository profiles;
    private final NotificationRepository notifications;
    private final NotificationStream stream;
    private final OuvrageRepository ouvrages;

    public CapteurRegistreController(CapteurRepository capteurs, TerritorialScope scope,
                                     UserProfileRepository profiles, NotificationRepository notifications,
                                     NotificationStream stream, OuvrageRepository ouvrages) {
        this.capteurs      = capteurs;
        this.scope         = scope;
        this.profiles      = profiles;
        this.notifications = notifications;
        this.stream        = stream;
        this.ouvrages      = ouvrages;
    }

    /**
     * Verrou d'intégrité à l'écriture : un capteur ne peut référencer qu'un ouvrage RÉEL du
     * registre, dans son périmètre. Ce qui est garanti, c'est que l'{@code ouvrageId} RÉSOUT —
     * pas que le libellé égale le nom du registre : le libellé dénormalisé peut être une
     * ÉTIQUETTE DE STATION volontairement distincte (ex. « Château d'eau Carrefour » regroupant
     * plusieurs capteurs sur un même ouvrage). On garde donc l'étiquette fournie ; à défaut, on
     * retombe sur le nom canonique du registre.
     *
     * @return le libellé à dénormaliser (étiquette fournie, sinon nom du registre), ou
     *         {@code null} si le capteur n'est volontairement rattaché à aucun ouvrage
     */
    private String resolveOuvrage(String ouvrageId, String ouvrageNom, String department) {
        boolean hasId  = ouvrageId  != null && !ouvrageId.isBlank();
        boolean hasNom = ouvrageNom != null && !ouvrageNom.isBlank();
        if (!hasId) {
            // Nom libre SANS ouvrage du registre → refus : on force la sélection (c'est ce qui a
            // laissé entrer des références fantômes / des noms qui ne résolvent nulle part).
            if (hasNom) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "Sélectionnez l'ouvrage dans le registre — le texte libre n'est plus accepté");
            }
            return null;   // capteur non rattaché (légitime)
        }
        OuvrageEntity ouvrage = ouvrages.findById(ouvrageId.trim()).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "Ouvrage « " + ouvrageId + " » introuvable — rattachez le capteur à un ouvrage du registre"));
        if (ouvrage.getDepartment() == null || !ouvrage.getDepartment().equalsIgnoreCase(department)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ouvrage hors de votre périmètre");
        }
        // Étiquette de station si fournie, sinon nom canonique du registre.
        return hasNom ? ouvrageNom.trim() : ouvrage.getNom();
    }

    @GetMapping
    public List<CapteurResponse> list(@RequestParam(required = false) String departementId, Authentication auth) {
        TerritorialScope.Scope s = scope.resolve(auth);
        List<CapteurEntity> rows;
        switch (s.niveau()) {
            case NATIONAL:
                rows = (departementId != null && !departementId.isBlank())
                        ? capteurs.findByDepartmentIgnoreCaseOrderByCodeAsc(departementId)
                        : capteurs.findAllByOrderByCodeAsc();
                break;
            case DEPARTEMENT:
                rows = capteurs.findByDepartmentIgnoreCaseOrderByCodeAsc(s.departement());
                break;
            case COMMUNE:
                rows = (s.commune() != null) ? capteurs.findByCommuneIgnoreCaseOrderByCodeAsc(s.commune()) : List.of();
                break;
            case AUCUN:
            default:
                return List.of();
        }
        return rows.stream().map(this::toResponse).toList();
    }

    // ── Déclaration / installation ──────────────────────────────────────────
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public CapteurResponse declarer(@RequestBody DeclareRequest req, Authentication auth) {
        if (req.nom() == null || req.nom().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom est requis");
        }
        if (req.type() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le type est requis");
        }

        TerritorialScope.Scope s = scope.resolve(auth);
        boolean declarationTepac = s.estCommune();

        final String department;
        final String commune;
        final CapteurValidation statut;
        if (declarationTepac) {
            if (s.departement() == null || s.departement().isBlank()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Périmètre TEPAC incomplet (département absent du token)");
            }
            department = s.departement();
            commune    = s.commune();
            statut     = CapteurValidation.EN_ATTENTE_VALIDATION;
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
            statut     = CapteurValidation.VALIDEE;
        }

        String code = (req.code() != null && !req.code().isBlank()) ? req.code().trim() : null;
        if (code != null && capteurs.existsByCode(code)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Le code « " + code + " » existe déjà");
        }
        if (req.deviceId() != null && !req.deviceId().isBlank() && capteurs.existsByDeviceIdIgnoreCase(req.deviceId().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Le device « " + req.deviceId() + " » est déjà rattaché à un capteur");
        }

        // Intégrité référentielle : l'ouvrage doit exister dans le registre et être dans le
        // périmètre ; le nom dénormalisé est dérivé du registre (canonique), pas du texte client.
        String ouvrageId  = (req.ouvrageId() != null && !req.ouvrageId().isBlank()) ? req.ouvrageId().trim() : null;
        String ouvrageNom = resolveOuvrage(ouvrageId, req.ouvrageNom(), department);

        String createdBy = (auth != null) ? auth.getName() : req.createdBy();
        CapteurEntity entity = new CapteurEntity(
                req.id(), code, req.nom().trim(), req.type(), department, commune,
                ouvrageId, ouvrageNom, req.deviceId(), req.mqttTopic(), req.unit(),
                req.lat(), req.lon(), createdBy);
        entity.setStatut(statut);
        CapteurEntity saved = capteurs.save(entity);

        if (declarationTepac) {
            List<String> cibles = profiles.validateursDuDept(department, createdBy == null ? "" : createdBy);
            Instant now = Instant.now();
            String titre = "Capteur à valider — " + (commune != null ? commune : department);
            String corps = saved.getNom() + " · " + saved.getType()
                    + (saved.getOuvrageNom() != null ? " · " + saved.getOuvrageNom() : "");
            for (String username : cibles) {
                NotificationEntity n = notifications.save(new NotificationEntity(
                        username, "CAPTEUR_ATTENTE", titre, corps, null, commune, now));
                stream.push(username, NotificationStream.payload(n.getId(), titre, null));
            }
        }

        return toResponse(saved);
    }

    // ── Validation (superviseur d'URD) ──────────────────────────────────────
    @PatchMapping("/{id}/valider")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD')")
    @Transactional
    public CapteurResponse valider(@PathVariable("id") String id, Authentication auth) {
        CapteurEntity c = chargerPourDecision(id, auth);
        c.valider(auth != null ? auth.getName() : "system", Instant.now());
        capteurs.save(c);
        notifierCreateur(c, "CAPTEUR_VALIDEE", "Capteur validé — " + c.getNom(),
                c.getNom() + " est désormais actif dans le réseau IoT.");
        return toResponse(c);
    }

    @PatchMapping("/{id}/rejeter")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD')")
    @Transactional
    public CapteurResponse rejeter(@PathVariable("id") String id, @RequestBody DecisionRequest body, Authentication auth) {
        if (body == null || body.motif() == null || body.motif().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un motif de rejet est requis");
        }
        CapteurEntity c = chargerPourDecision(id, auth);
        c.rejeter(auth != null ? auth.getName() : "system", Instant.now(), body.motif().trim());
        capteurs.save(c);
        notifierCreateur(c, "CAPTEUR_REJETEE", "Capteur rejeté — " + c.getNom(),
                "Motif : " + body.motif().trim());
        return toResponse(c);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private CapteurEntity chargerPourDecision(String id, Authentication auth) {
        CapteurEntity c = capteurs.findById(id).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Capteur introuvable"));
        if (SecurityScope.isSupervisor(auth)) {
            String tokenDept = SecurityScope.tokenDept(auth);
            if (tokenDept == null || c.getDepartment() == null || !tokenDept.equalsIgnoreCase(c.getDepartment())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Hors de votre périmètre départemental (" + tokenDept + ")");
            }
        }
        return c;
    }

    private void notifierCreateur(CapteurEntity c, String type, String titre, String corps) {
        if (c.getCreatedBy() == null || c.getCreatedBy().isBlank() || "seed".equals(c.getCreatedBy())) return;
        Instant now = Instant.now();
        NotificationEntity n = notifications.save(new NotificationEntity(
                c.getCreatedBy(), type, titre, corps, null, c.getCommune(), now));
        stream.push(c.getCreatedBy(), NotificationStream.payload(n.getId(), titre, null));
    }

    private String etatOf(CapteurEntity c) {
        if (c.getStatut() == CapteurValidation.EN_ATTENTE_VALIDATION) return "en-attente";
        if (c.getStatut() == CapteurValidation.REJETEE) return "rejete";
        if (c.getLastSeen() == null || c.getLastValue() == null) return "hors-ligne";
        if (Duration.between(c.getLastSeen(), Instant.now()).compareTo(FRESH) > 0) return "hors-ligne";
        return seuilEtat(c.getType(), c.getLastValue());
    }

    private static String seuilEtat(CapteurType type, double v) {
        switch (type) {
            case PRESSION: return v < 0.8 ? "critique" : v < 1.5 ? "attention" : "en-ligne";
            case NIVEAU:   return v < 20  ? "critique" : v < 50  ? "attention" : "en-ligne";
            case DEBIT:    return v <= 0  ? "critique" : v < 1   ? "attention" : "en-ligne";
            default:       return "en-ligne";
        }
    }

    private CapteurResponse toResponse(CapteurEntity c) {
        String mesure = (c.getLastValue() != null)
                ? trim(c.getLastValue()) + (c.getUnit() != null ? " " + c.getUnit() : "")
                : "aucune mesure";
        return new CapteurResponse(
                c.getId(), c.getCode(), c.getNom(), c.getType(), c.getCommune(), c.getDepartment(),
                c.getOuvrageId(), c.getOuvrageNom(), c.getDeviceId(), c.getMqttTopic(), c.getUnit(),
                c.getLat(), c.getLon(), etatOf(c), mesure,
                c.getLastValue(), c.getBattery(), c.getSignal(),
                c.getLastSeen() != null ? c.getLastSeen().toString() : null,
                c.getStatut(), c.getCreatedBy(), c.getValidatedBy(),
                c.getValidatedAt() != null ? c.getValidatedAt().toString() : null, c.getMotifRejet(),
                c.getCreatedAt() != null ? c.getCreatedAt().toString() : null);
    }

    private static String trim(double v) {
        String s = (v == Math.rint(v)) ? String.valueOf((long) v) : String.valueOf(v);
        return s.replace('.', ',');
    }

    // ── Records ───────────────────────────────────────────────────────────

    public record DeclareRequest(
            String id, String code, String nom, CapteurType type,
            String department, String commune, String ouvrageId, String ouvrageNom,
            String deviceId, String mqttTopic, String unit, Double lat, Double lon, String createdBy
    ) {}

    public record DecisionRequest(String motif) {}

    public record CapteurResponse(
            String id, String code, String nom, CapteurType type, String commune, String departement,
            String ouvrageId, String ouvrageNom, String deviceId, String mqttTopic, String unit,
            Double lat, Double lon, String etat, String mesure,
            Double lastValue, Integer battery, Integer signal, String derniereMesure,
            CapteurValidation statut, String createdBy, String validatedBy, String validatedAt, String motifRejet,
            String createdAt
    ) {}
}
