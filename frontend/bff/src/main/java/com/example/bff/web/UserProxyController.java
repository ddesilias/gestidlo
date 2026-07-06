package com.example.bff.web;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping("/api/users")
public class UserProxyController {

    private final RestClient metier;

    public UserProxyController(@Qualifier("metierRestClient") RestClient metierRestClient) {
        this.metier = metierRestClient;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode createUser(@RequestBody Map<String, Object> body) {
        return metier.post().uri("/api/users").body(body).retrieve().body(JsonNode.class);
    }

    @GetMapping
    public JsonNode listUsers(@RequestParam(required = false) String urdId) {
        String uri = urdId != null
                ? UriComponentsBuilder.fromPath("/api/users").queryParam("urdId", urdId).toUriString()
                : "/api/users";
        return metier.get().uri(uri).retrieve().body(JsonNode.class);
    }
}
