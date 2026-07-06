package com.example.api_metier.web;

import com.example.api_metier.domain.ActeurType;
import com.example.api_metier.domain.CommuneEntity;
import com.example.api_metier.repo.ActeurRepository;
import com.example.api_metier.repo.CommuneRepository;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Communes proposées dans les formulaires (dropdown), scopées par le résolveur partagé.
 * Un superviseur (ou un TEPAC) ne reçoit QUE les communes de son département — verrou JWT,
 * jamais un paramètre client. L'admin (national) peut cibler un département via {@code ?departementId}.
 * Le {@code select} est ainsi alimenté par une seule source serveur, comme la carte et les listes.
 */
@RestController
@RequestMapping("/api/communes")
public class CommuneController {

    private final CommuneRepository communes;
    private final ActeurRepository acteurs;
    private final TerritorialScope scope;

    public CommuneController(CommuneRepository communes, ActeurRepository acteurs, TerritorialScope scope) {
        this.communes = communes;
        this.acteurs  = acteurs;
        this.scope    = scope;
    }

    @GetMapping
    public List<CommuneResponse> list(@RequestParam(required = false) String departementId, Authentication auth) {
        TerritorialScope.Scope s = scope.resolve(auth);
        List<CommuneEntity> rows;
        switch (s.niveau()) {
            case NATIONAL:
                rows = (departementId != null && !departementId.isBlank())
                        ? communes.findByDepartementIdIgnoreCaseOrderByNomAsc(departementId)
                        : communes.findAllByOrderByNomAsc();
                break;
            case DEPARTEMENT:
            case COMMUNE:
                // Superviseur ET technicien : verrouillés sur les communes de LEUR département.
                rows = communes.findByDepartementIdIgnoreCaseOrderByNomAsc(s.departement());
                break;
            case AUCUN:
            default:
                return List.of();
        }
        // aUnTepac : un TEPAC vivant est déjà rattaché à cette commune (même clé que la règle
        // d'unicité). On AFFICHE toutes les communes ; le front grise/marque les pourvues.
        return rows.stream()
                .map(c -> new CommuneResponse(
                        c.getId(), c.getNom(), c.getArrondissement(), c.getDepartementId(),
                        acteurs.existsByTypeAndDepartementIdAndCommuneIgnoreCaseAndSupprimeLeIsNull(
                                ActeurType.TEPAC, c.getDepartementId(), c.getNom())))
                .toList();
    }

    public record CommuneResponse(String id, String nom, String arrondissement, String departementId,
                                  boolean aUnTepac) {}
}
