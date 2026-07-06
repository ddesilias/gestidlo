package com.example.bff.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@Configuration
public class DownstreamClientsConfig {

	private static final ObjectMapper MAPPER = new ObjectMapper();

	/** Extrait le motif lisible du corps d'erreur d'api-metier ({"message": …} / {"error": …}),
	 *  pour le relayer proprement au front au lieu du JSON brut. Corps non-JSON → renvoyé tel quel. */
	private static String extraireMotif(String body) {
		try {
			var node = MAPPER.readTree(body);
			var message = node.path("message").asText("");
			if (!message.isBlank()) return message;
			var error = node.path("error").asText("");
			if (!error.isBlank()) return error;
		} catch (Exception ignore) {
			// corps non-JSON : on garde le brut
		}
		return body;
	}

	@Bean
	RestClient metierRestClient(@Value("${gestidlo.api-metier.url}") String baseUrl) {
		return RestClient.builder()
				.baseUrl(baseUrl)
				.requestInterceptor((request, body, execution) -> {
					Authentication auth = SecurityContextHolder.getContext().getAuthentication();
					if (auth instanceof JwtAuthenticationToken jwtAuth) {
						request.getHeaders().set(HttpHeaders.AUTHORIZATION, "Bearer " + jwtAuth.getToken().getTokenValue());
					}
					return execution.execute(request, body);
				})
				// Propage le statut du métier (403/422/400…) au lieu de tout muer en 500 :
				// un garde-fou serveur (ex. activation de zone hors périmètre) doit rester un 403 pour la SPA.
				.defaultStatusHandler(HttpStatusCode::isError, (clientReq, clientRes) -> {
					byte[] raw;
					try {
						raw = clientRes.getBody().readAllBytes();
					} catch (IOException e) {
						raw = new byte[0];
					}
					String body = raw.length > 0 ? new String(raw, StandardCharsets.UTF_8) : clientRes.getStatusText();
					throw new ResponseStatusException(clientRes.getStatusCode(), extraireMotif(body));
				})
				.build();
	}

	@Bean
	RestClient camundaApiRestClient(@Value("${gestidlo.camunda-api.url}") String baseUrl) {
		return RestClient.builder().baseUrl(baseUrl).build();
	}
}
