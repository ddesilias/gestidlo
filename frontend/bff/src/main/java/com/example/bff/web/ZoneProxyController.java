package com.example.bff.web;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

@RestController
@RequestMapping("/api/zones")
public class ZoneProxyController {

	private final RestClient metier;

	public ZoneProxyController(@Qualifier("metierRestClient") RestClient metierRestClient) {
		this.metier = metierRestClient;
	}

	@GetMapping
	public JsonNode list(@RequestParam(name = "departementId", required = false) String departementId) {
		return metier.get().uri(b -> b.path("/api/zones")
				.queryParamIfPresent("departementId", Optional.ofNullable(departementId).filter(s -> !s.isBlank()))
				.build()).retrieve().body(JsonNode.class);
	}

	@PostMapping("/activer")
	@ResponseStatus(HttpStatus.CREATED)
	public JsonNode activer(@RequestBody Map<String, Object> body) {
		return metier.post().uri("/api/zones/activer").body(body).retrieve().body(JsonNode.class);
	}

	@PostMapping("/{id}/activer")
	public JsonNode activerExistante(@PathVariable("id") String id) {
		return metier.post().uri("/api/zones/{id}/activer", id).retrieve().body(JsonNode.class);
	}
}
