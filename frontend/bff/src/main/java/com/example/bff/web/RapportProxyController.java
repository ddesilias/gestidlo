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
@RequestMapping("/api/rapports")
public class RapportProxyController {

	private final RestClient metier;

	public RapportProxyController(@Qualifier("metierRestClient") RestClient metierRestClient) {
		this.metier = metierRestClient;
	}

	@GetMapping
	public JsonNode list(@RequestParam(name = "departementId", required = false) String departementId,
			@RequestParam(name = "status", required = false) String status) {
		return metier.get().uri(b -> b.path("/api/rapports")
				.queryParamIfPresent("departementId", Optional.ofNullable(departementId).filter(s -> !s.isBlank()))
				.queryParamIfPresent("status", Optional.ofNullable(status).filter(s -> !s.isBlank()))
				.build()).retrieve().body(JsonNode.class);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public JsonNode creer(@RequestBody Map<String, Object> body) {
		return metier.post().uri("/api/rapports").body(body).retrieve().body(JsonNode.class);
	}

	@PostMapping("/{id}/transmettre")
	public JsonNode transmettre(@PathVariable("id") String id) {
		return metier.post().uri("/api/rapports/{id}/transmettre", id).retrieve().body(JsonNode.class);
	}

	@PostMapping("/{id}/valider")
	public JsonNode valider(@PathVariable("id") String id,
			@RequestBody(required = false) Map<String, Object> body) {
		var spec = metier.post().uri("/api/rapports/{id}/valider", id);
		return (body != null ? spec.body(body) : spec).retrieve().body(JsonNode.class);
	}

	@PostMapping("/{id}/signer")
	public JsonNode signer(@PathVariable("id") String id) {
		return metier.post().uri("/api/rapports/{id}/signer", id).retrieve().body(JsonNode.class);
	}

	@PostMapping("/{id}/renvoyer")
	public JsonNode renvoyer(@PathVariable("id") String id, @RequestBody Map<String, Object> body) {
		return metier.post().uri("/api/rapports/{id}/renvoyer", id).body(body).retrieve().body(JsonNode.class);
	}
}
