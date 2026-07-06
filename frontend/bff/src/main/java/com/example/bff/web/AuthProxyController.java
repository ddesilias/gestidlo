package com.example.bff.web;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

@RestController
@RequestMapping("/api/auth")
public class AuthProxyController {

	private final RestClient metier;

	public AuthProxyController(@Qualifier("metierRestClient") RestClient metierRestClient) {
		this.metier = metierRestClient;
	}

	@PostMapping("/login")
	public JsonNode login(@RequestBody Map<String, Object> body) {
		return metier.post().uri("/api/auth/login").body(body).retrieve().body(JsonNode.class);
	}

	@GetMapping("/me")
	public JsonNode me() {
		return metier.get().uri("/api/auth/me").retrieve().body(JsonNode.class);
	}

	@PostMapping("/accounts")
	@ResponseStatus(HttpStatus.CREATED)
	public JsonNode createAccount(@RequestBody Map<String, Object> body) {
		return metier.post().uri("/api/auth/accounts").body(body).retrieve().body(JsonNode.class);
	}
}

