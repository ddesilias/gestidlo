package com.example.api_metier.web;

import com.example.api_metier.domain.AlertStatus;
import com.example.api_metier.domain.MeasurementEntity;
import com.example.api_metier.domain.PointRefEntity;
import com.example.api_metier.repo.AlertRepository;
import com.example.api_metier.repo.MeasurementRepository;
import com.example.api_metier.repo.PointRefRepository;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Module Capteurs (DÉRIVÉ) — l'état des points de mesure scopé par le résolveur partagé.
 * Alimente la carte du dashboard et l'accueil superviseur (points + dernière mesure + alerte).
 * Le registre des capteurs déclarés (cycle de validation) vit dans {@link CapteurRegistreController}
 * sous {@code /api/iot/capteurs}. Ici on reste sur la vue dérivée historique :
 *   - point avec alerte ouverte (ACTIVE) → « seuil dépassé »
 *   - sinon, dernière mesure connue       → « OK » (+ valeur)
 *   - sinon (aucune mesure)               → « hors ligne »
 */
@RestController
@RequestMapping("/api/capteurs")
public class CapteurController {

    private final PointRefRepository points;
    private final MeasurementRepository measurements;
    private final AlertRepository alerts;
    private final TerritorialScope scope;

    public CapteurController(PointRefRepository points, MeasurementRepository measurements,
                             AlertRepository alerts, TerritorialScope scope) {
        this.points       = points;
        this.measurements = measurements;
        this.alerts       = alerts;
        this.scope        = scope;
    }

    @GetMapping
    public List<CapteurResponse> list(@RequestParam(required = false) String departementId, Authentication auth) {
        TerritorialScope.Scope s = scope.resolve(auth);
        List<PointRefEntity> pts;
        switch (s.niveau()) {
            case NATIONAL:
                pts = (departementId != null && !departementId.isBlank())
                        ? points.findByTerritoryIgnoreCaseAndActiveTrueOrderByIdAsc(departementId)
                        : points.findByActiveTrueOrderByIdAsc();
                break;
            case DEPARTEMENT:
                pts = points.findByTerritoryIgnoreCaseAndActiveTrueOrderByIdAsc(s.departement());
                break;
            case COMMUNE:
                pts = points.findByCommuneIgnoreCaseAndActiveTrueOrderByIdAsc(s.commune());
                break;
            case AUCUN:
            default:
                return List.of();
        }
        return pts.stream().map(this::toCapteur).toList();
    }

    private CapteurResponse toCapteur(PointRefEntity p) {
        boolean seuil = alerts.existsByPointIdAndStatus(p.getId(), AlertStatus.ACTIVE);
        MeasurementEntity last = measurements.findTop1ByPointIdOrderByTimestampDesc(p.getId()).orElse(null);
        String etat = seuil ? "seuil" : (last != null ? "ok" : "hors-ligne");
        String mesure = last != null
                ? trim(last.getValue()) + (last.getUnit() != null ? " " + last.getUnit() : "")
                : "aucune mesure";
        return new CapteurResponse(
                p.getId(), p.getName(), p.getType(), p.getCommune(), p.getTerritory(),
                p.getLat(), p.getLon(),
                etat, mesure, last != null ? last.getTimestamp().toString() : null);
    }

    /** Affichage compact : 18.0 → « 18 », 4.2 → « 4,2 » (virgule décimale FR). */
    private static String trim(double v) {
        String s = (v == Math.rint(v)) ? String.valueOf((long) v) : String.valueOf(v);
        return s.replace('.', ',');
    }

    public record CapteurResponse(
            String pointId, String nom, String type, String commune, String departement,
            Double lat, Double lon,
            String etat, String mesure, String derniereMesure) {}
}
