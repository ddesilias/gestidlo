package com.example.bff.web;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Proxy BFF → api-metier pour les notifications de l'utilisateur (clé d'auth du JWT, transmis).
 * Le flux SSE {@code /api/notifications/stream} n'est PAS proxifié ici (streaming) : le front
 * retombe sur le polling de secours sur cet endpoint GET.
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationProxyController {

    private final RestClient metier;

    public NotificationProxyController(@Qualifier("metierRestClient") RestClient metierRestClient) {
        this.metier = metierRestClient;
    }

    @GetMapping
    public JsonNode list(@RequestParam(name = "lu", required = false) Boolean lu) {
        String uri = lu != null
                ? UriComponentsBuilder.fromPath("/api/notifications").queryParam("lu", lu).toUriString()
                : "/api/notifications";
        return metier.get().uri(uri).retrieve().body(JsonNode.class);
    }

    @PostMapping("/{id}/lu")
    public JsonNode marquerLu(@PathVariable Long id) {
        return metier.post().uri("/api/notifications/{id}/lu", id).retrieve().body(JsonNode.class);
    }

    @PostMapping("/tout-lu")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void toutMarquerLu() {
        metier.post().uri("/api/notifications/tout-lu").retrieve().toBodilessEntity();
    }
}
