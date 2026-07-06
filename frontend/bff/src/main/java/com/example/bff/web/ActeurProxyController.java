package com.example.bff.web;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/acteurs")
public class ActeurProxyController {

    private final RestClient metier;

    public ActeurProxyController(@Qualifier("metierRestClient") RestClient metierRestClient) {
        this.metier = metierRestClient;
    }

    @GetMapping
    public JsonNode list(@RequestParam(required = false) String departementId) {
        String uri = departementId != null
                ? UriComponentsBuilder.fromPath("/api/acteurs").queryParam("departementId", departementId).toUriString()
                : "/api/acteurs";
        return metier.get().uri(uri).retrieve().body(JsonNode.class);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode create(@RequestBody Map<String, Object> body) {
        return metier.post().uri("/api/acteurs").body(body).retrieve().body(JsonNode.class);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        metier.delete().uri("/api/acteurs/{id}", id).retrieve().toBodilessEntity();
    }

    @PatchMapping("/{id}/statut")
    public JsonNode changerStatut(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return metier.patch().uri("/api/acteurs/{id}/statut", id).body(body).retrieve().body(JsonNode.class);
    }
}
