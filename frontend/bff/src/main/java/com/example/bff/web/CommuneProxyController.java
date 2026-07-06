package com.example.bff.web;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

/** Proxy BFF → api-metier pour le référentiel des communes (scopé par le JWT côté métier). */
@RestController
@RequestMapping("/api/communes")
public class CommuneProxyController {

    private final RestClient metier;

    public CommuneProxyController(@Qualifier("metierRestClient") RestClient metierRestClient) {
        this.metier = metierRestClient;
    }

    @GetMapping
    public JsonNode list(@RequestParam(required = false) String departementId) {
        String uri = departementId != null
                ? UriComponentsBuilder.fromPath("/api/communes").queryParam("departementId", departementId).toUriString()
                : "/api/communes";
        return metier.get().uri(uri).retrieve().body(JsonNode.class);
    }
}
