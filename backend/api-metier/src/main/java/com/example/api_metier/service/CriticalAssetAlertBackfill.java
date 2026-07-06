package com.example.api_metier.service;

import com.example.api_metier.domain.AlertSeverity;
import com.example.api_metier.domain.OuvrageEntity;
import com.example.api_metier.domain.OuvrageEtat;
import com.example.api_metier.domain.OuvrageValidation;
import com.example.api_metier.domain.RessourceEntity;
import com.example.api_metier.domain.RessourceEtat;
import com.example.api_metier.domain.RessourceStatut;
import com.example.api_metier.repo.OuvrageRepository;
import com.example.api_metier.repo.RessourceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Réconciliation unique du stock existant : la boucle métier {@link AutoAlertService} n'émet
 * qu'aux TRANSITIONS (création/validation) — elle ne « voit » pas les actifs déjà en base
 * (seed, imports antérieurs) qui sont POLLUÉS / MENACÉS / EN PANNE sans alerte associée.
 *
 * <p>Ce runner repasse une fois sur ces actifs OFFICIELS et crée l'alerte manquante via
 * {@link AutoAlertService#emitSilent} : l'alerte apparaît dans les files scopées (la chaîne
 * ressource/ouvrage → commune → département → URD jouant comme pour une alerte vivante), mais
 * SANS fan-out — on ne fait pas sonner rétroactivement la cloche de tout le monde. Idempotent :
 * la dédup par (point, type, ACTIVE) le rend sûr à chaque démarrage ; ce n'est PAS une seconde
 * source d'événements, juste une passe de cohérence des données.
 *
 * <p>Désactivable par configuration ({@code gestidlo.backfill.critical-alerts=false}) — utile en
 * production à grande échelle si l'on ne veut pas matérialiser d'un coup tout l'historique.
 */
@Component
@Order(20)
@ConditionalOnProperty(prefix = "gestidlo.backfill", name = "critical-alerts", havingValue = "true", matchIfMissing = true)
public class CriticalAssetAlertBackfill implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(CriticalAssetAlertBackfill.class);

    private final RessourceRepository ressources;
    private final OuvrageRepository ouvrages;
    private final AutoAlertService autoAlerts;

    public CriticalAssetAlertBackfill(RessourceRepository ressources,
                                      OuvrageRepository ouvrages,
                                      AutoAlertService autoAlerts) {
        this.ressources = ressources;
        this.ouvrages   = ouvrages;
        this.autoAlerts = autoAlerts;
    }

    @Override
    @Transactional
    public void run(String... args) {
        int ressourcesTouchees = 0;
        for (RessourceEntity r : ressources.findAll()) {
            // Seules les ressources OFFICIELLES (validées) émettent — un recensement TEPAC
            // en attente n'est pas encore du patrimoine, il émettra à sa validation.
            if (r.getStatut() != RessourceStatut.VALIDEE) continue;
            RessourceEtat etat = r.getEtat();
            if (etat != RessourceEtat.POLLUEE && etat != RessourceEtat.MENACEE) continue;
            boolean polluee = etat == RessourceEtat.POLLUEE;
            autoAlerts.emitSilent(
                    "RES-" + r.getId(),
                    polluee ? "RESSOURCE_POLLUEE" : "RESSOURCE_MENACEE",
                    polluee ? AlertSeverity.CRIT : AlertSeverity.WARN,
                    r.getNom() + " — ressource " + (polluee ? "polluée" : "menacée"),
                    r.getCommune(), r.getId());
            ressourcesTouchees++;
        }

        int ouvragesTouches = 0;
        for (OuvrageEntity o : ouvrages.findAll()) {
            if (o.getStatut() != OuvrageValidation.VALIDEE) continue;
            if (o.getEtat() != OuvrageEtat.PANNE) continue;
            autoAlerts.emitSilent(
                    "OUV-" + o.getId(),
                    "OUVRAGE_PANNE",
                    AlertSeverity.CRIT,
                    o.getNom() + " — ouvrage en panne",
                    o.getCommune(), null);
            ouvragesTouches++;
        }

        log.info("Backfill alertes critiques : {} ressource(s) + {} ouvrage(s) parcourus (alertes créées seulement si manquantes, dédup active).",
                ressourcesTouchees, ouvragesTouches);
    }
}
