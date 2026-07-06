package com.example.bff.web;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping("/api/ressources")
public class RessourceProxyController {

    private final RestClient metier;

    public RessourceProxyController(@Qualifier("metierRestClient") RestClient metierRestClient) {
        this.metier = metierRestClient;
    }

    @GetMapping
    public JsonNode list(@RequestParam(required = false) String departementId) {
        String uri = departementId != null
                ? UriComponentsBuilder.fromPath("/api/ressources").queryParam("departementId", departementId).toUriString()
                : "/api/ressources";
        return metier.get().uri(uri).retrieve().body(JsonNode.class);
    }

    @GetMapping("/kpi")
    public JsonNode kpi(@RequestParam(required = false) String departementId) {
        String uri = departementId != null
                ? UriComponentsBuilder.fromPath("/api/ressources/kpi").queryParam("departementId", departementId).toUriString()
                : "/api/ressources/kpi";
        return metier.get().uri(uri).retrieve().body(JsonNode.class);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode create(@RequestBody Map<String, Object> body) {
        return metier.post().uri("/api/ressources").body(body).retrieve().body(JsonNode.class);
    }

    // ── Cycle de validation (superviseur d'URD) ──────────────────────────────

    @PatchMapping("/{id}/valider")
    public JsonNode valider(@PathVariable("id") String id) {
        return metier.patch().uri("/api/ressources/{id}/valider", id).retrieve().body(JsonNode.class);
    }

    @PatchMapping("/{id}/rejeter")
    public JsonNode rejeter(@PathVariable("id") String id, @RequestBody Map<String, Object> body) {
        return metier.patch().uri("/api/ressources/{id}/rejeter", id).body(body).retrieve().body(JsonNode.class);
    }
}
