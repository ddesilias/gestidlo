package com.example.api_metier.web;

import com.example.api_metier.domain.NotificationEntity;
import com.example.api_metier.repo.NotificationRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Boîte de notifications de l'utilisateur connecté (clé d'auth = username du JWT).
 * Chacun ne lit/modifie QUE ses propres notifications — pas de scope territorial ici :
 * le ciblage a déjà été fait par le fan-out à la création de l'alerte.
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationRepository notifications;
    private final NotificationStream stream;
    private final JwtDecoder jwtDecoder;

    public NotificationController(NotificationRepository notifications,
                                  NotificationStream stream, JwtDecoder jwtDecoder) {
        this.notifications = notifications;
        this.stream        = stream;
        this.jwtDecoder    = jwtDecoder;
    }

    /**
     * Flux SSE temps réel. EventSource ne peut pas envoyer d'en-tête Authorization, donc le token
     * arrive en query param et est validé ici (endpoint permitAll). On n'ouvre le flux que pour le
     * username du token — pas d'usurpation possible.
     */
    @GetMapping("/stream")
    public SseEmitter stream(@RequestParam("token") String token) {
        String username;
        try {
            username = jwtDecoder.decode(token).getSubject();
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token invalide");
        }
        if (username == null || username.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token invalide");
        }
        return stream.register(username);
    }

    @GetMapping
    public List<NotificationResponse> list(@RequestParam(name = "lu", required = false) Boolean lu,
                                           Authentication auth) {
        String me = auth.getName();
        List<NotificationEntity> rows = (lu == null)
                ? notifications.findByUsernameOrderByCreatedAtDesc(me)
                : notifications.findByUsernameAndLuOrderByCreatedAtDesc(me, lu);
        return rows.stream().map(NotificationController::toResponse).toList();
    }

    @PostMapping("/{id}/lu")
    public NotificationResponse marquerLu(@PathVariable Long id, Authentication auth) {
        NotificationEntity n = notifications.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification introuvable"));
        if (!n.getUsername().equals(auth.getName())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Pas votre notification");
        }
        n.setLu(true);
        return toResponse(notifications.save(n));
    }

    @PostMapping("/tout-lu")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void toutMarquerLu(Authentication auth) {
        for (NotificationEntity n : notifications.findByUsernameAndLuOrderByCreatedAtDesc(auth.getName(), false)) {
            n.setLu(true);
            notifications.save(n);
        }
    }

    private static NotificationResponse toResponse(NotificationEntity n) {
        return new NotificationResponse(
                n.getId(), n.getType(), n.getTitre(), n.getCorps(), n.getAlertId(),
                n.getCommune(), n.isLu(), n.getCreatedAt() != null ? n.getCreatedAt().toString() : null);
    }

    public record NotificationResponse(
            Long id, String type, String titre, String corps, Long alertId,
            String commune, boolean lu, String createdAt) {}
}
