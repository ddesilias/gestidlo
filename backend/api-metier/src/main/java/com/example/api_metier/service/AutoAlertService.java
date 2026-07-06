package com.example.api_metier.service;

import com.example.api_metier.domain.AlertEntity;
import com.example.api_metier.domain.AlertSeverity;
import com.example.api_metier.domain.AlertStatus;
import com.example.api_metier.domain.NotificationEntity;
import com.example.api_metier.repo.AlertRepository;
import com.example.api_metier.repo.NotificationRepository;
import com.example.api_metier.repo.UserProfileRepository;
import com.example.api_metier.web.NotificationStream;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Boucle métier : un actif qui bascule dans un état critique émet AUTOMATIQUEMENT une alerte,
 * qui remonte ensuite la chaîne ressource/ouvrage → commune → département → URD via le
 * même périmètre que les alertes manuelles.
 *
 * <p>Déclencheurs aujourd'hui (états de bascule, jamais rétroactifs sur le seed) :
 * <ul>
 *   <li>Ressource {@code POLLUEE} → alerte CRIT, {@code MENACEE} → alerte WARN ;</li>
 *   <li>Ouvrage {@code PANNE} → alerte CRIT.</li>
 * </ul>
 *
 * <p>L'émission est IDEMPOTENTE : tant qu'une alerte ACTIVE du même type pèse sur le même
 * point, on n'en recrée pas une seconde (pas de spam si la validation est rejouée). Le point
 * porté par l'alerte est synthétique et stable ({@code RES-<id>} / {@code OUV-<id>}) ; c'est la
 * commune dénormalisée qui rattache l'alerte à son département pour la lecture scopée.
 */
@Service
public class AutoAlertService {

    private final AlertRepository alerts;
    private final UserProfileRepository profiles;
    private final NotificationRepository notifications;
    private final NotificationStream stream;

    public AutoAlertService(AlertRepository alerts, UserProfileRepository profiles,
                            NotificationRepository notifications, NotificationStream stream) {
        this.alerts        = alerts;
        this.profiles      = profiles;
        this.notifications = notifications;
        this.stream        = stream;
    }

    /**
     * Émet une alerte pour un actif passé en état critique, si aucune alerte ACTIVE du même
     * type ne le couvre déjà, puis fait le fan-out (admins + superviseurs du dept + TEPAC de
     * la commune), exactement comme une alerte manuelle.
     *
     * @param pointId     identité stable du point synthétique (ex. {@code RES-42}, {@code OUV-7})
     * @param type        type métier de l'alerte (ex. {@code RESSOURCE_POLLUEE})
     * @param severity    gravité
     * @param message     libellé lisible
     * @param dept        département (fan-out superviseurs)
     * @param commune     commune dénormalisée (rattachement scopé + fan-out TEPAC)
     * @param ressourceId lien dur optionnel vers la ressource d'origine (sinon {@code null})
     */
    public void emit(String pointId, String type, AlertSeverity severity, String message,
                     String dept, String commune, String ressourceId) {
        AlertEntity alert = create(pointId, type, severity, message, commune, ressourceId);
        if (alert == null) return;   // déjà couverte (dédup) → pas de re-notification
        fanOut(alert, dept, commune, message);
    }

    /**
     * Variante SILENCIEUSE pour la réconciliation d'un stock existant (backfill) : crée l'alerte
     * manquante (même dédup) pour qu'elle apparaisse dans les files scopées, SANS rejouer le
     * fan-out — on ne fait pas sonner la cloche de tout le monde pour un état historique.
     */
    public void emitSilent(String pointId, String type, AlertSeverity severity, String message,
                           String commune, String ressourceId) {
        create(pointId, type, severity, message, commune, ressourceId);
    }

    /** Crée l'alerte si aucune ACTIVE du même (point, type) n'existe ; renvoie null si dédupée. */
    private AlertEntity create(String pointId, String type, AlertSeverity severity, String message,
                               String commune, String ressourceId) {
        if (pointId == null || pointId.isBlank() || type == null || type.isBlank()) return null;
        if (alerts.findFirstByPointIdAndTypeAndStatusOrderByOpenedAtDesc(pointId, type, AlertStatus.ACTIVE).isPresent()) {
            return null;
        }
        Instant now = Instant.now();
        AlertEntity alert = new AlertEntity(
                pointId, "AUTO", type, severity, AlertStatus.ACTIVE, message, now, now, commune);
        if (ressourceId != null && !ressourceId.isBlank()) {
            alert.setRessourceId(ressourceId.trim());
        }
        return alerts.save(alert);
    }

    /** Fan-out : notifie tous ceux dont le périmètre couvre la commune (inverse du read-scope). */
    private void fanOut(AlertEntity alert, String dept, String commune, String message) {
        Instant now = Instant.now();
        List<String> cibles = profiles.destinatairesAlerte(
                dept == null ? "" : dept, commune == null ? "" : commune, "");
        String titre = "Alerte automatique — " + (commune != null && !commune.isBlank() ? commune
                : (dept != null ? dept : ""));
        for (String username : cibles) {
            NotificationEntity n = notifications.save(new NotificationEntity(
                    username, "ALERTE", titre, message, alert.getId(), commune, now));
            stream.push(username, NotificationStream.payload(n.getId(), titre, alert.getId()));
        }
    }
}
