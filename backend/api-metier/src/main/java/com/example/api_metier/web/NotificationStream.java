package com.example.api_metier.web;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Registre en mémoire des flux SSE ouverts, par username. Le fan-out d'alerte pousse une
 * notification temps réel à chaque destinataire connecté (en plus de la persistance en base
 * qui sert d'état initial / de filet si le client était hors-ligne). Remplace le polling.
 */
@Component
public class NotificationStream {

    private static final long TIMEOUT_MS = 60L * 60L * 1000L; // 1 h ; EventSource se reconnecte seul

    private final Map<String, Set<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public SseEmitter register(String username) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        Set<SseEmitter> set = emitters.computeIfAbsent(username, k -> new CopyOnWriteArraySet<>());
        set.add(emitter);
        emitter.onCompletion(() -> set.remove(emitter));
        emitter.onTimeout(() -> set.remove(emitter));
        emitter.onError(e -> set.remove(emitter));
        try {
            emitter.send(SseEmitter.event().name("ready").data("ok"));
        } catch (IOException ignored) {
            set.remove(emitter);
        }
        return emitter;
    }

    /** Pousse un évènement « notification » à tous les flux ouverts d'un utilisateur. */
    public void push(String username, Object payload) {
        Set<SseEmitter> set = emitters.get(username);
        if (set == null) return;
        for (SseEmitter e : set) {
            try {
                e.send(SseEmitter.event().name("notification").data(payload));
            } catch (IOException ex) {
                set.remove(e);
            }
        }
    }

    /** Helper pour un payload minimal (le client relit /notifications?lu=false derrière). */
    public static Map<String, Object> payload(Long id, String titre, Long alertId) {
        return Map.of("id", id, "titre", titre == null ? "" : titre, "alertId", alertId == null ? -1L : alertId);
    }
}
