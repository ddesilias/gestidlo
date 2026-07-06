package com.example.bff.web;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class BffController {

	private final RestClient metier;
	private final RestClient camundaApi;

	public BffController(
			@Qualifier("metierRestClient") RestClient metierRestClient,
			@Qualifier("camundaApiRestClient") RestClient camundaApiRestClient) {
		this.metier = metierRestClient;
		this.camundaApi = camundaApiRestClient;
	}

	@GetMapping("/health")
	public Map<String, Object> health() {
		Map<String, Object> res = new LinkedHashMap<>();
		res.put("bff", "UP");
		res.put("apiMetier", safeGetJson(metier, "/actuator/health"));
		res.put("camundaApi", safeGetJson(camundaApi, "/actuator/health"));
		return res;
	}

	@GetMapping("/dashboard")
	public Map<String, Object> dashboard() {
		Map<String, Object> res = new LinkedHashMap<>();
		res.put("realtime", safeGetJson(metier, "/api/realtime/points"));
		res.put("alerts", safeGetJson(metier, "/api/alerts?status=ACTIVE"));
		res.put("tickets", safeGetJson(metier, "/api/tickets"));
		res.put("processDefinitions", safeGetJson(camundaApi, "/api/process-definitions"));
		return res;
	}

	@PostMapping("/iot/measurements")
	public JsonNode ingest(@RequestBody Map<String, Object> body) {
		return metier.post().uri("/api/iot/measurements").body(body).retrieve().body(JsonNode.class);
	}

	@GetMapping("/realtime/points")
	public JsonNode realtime(@RequestParam(name = "pointIds", required = false) java.util.List<String> pointIds) {
		if (pointIds == null || pointIds.isEmpty()) {
			return metier.get().uri("/api/realtime/points").retrieve().body(JsonNode.class);
		}
		StringBuilder uri = new StringBuilder("/api/realtime/points");
		for (int i = 0; i < pointIds.size(); i++) {
			uri.append(i == 0 ? "?" : "&");
			uri.append("pointIds=").append(pointIds.get(i));
		}
		return metier.get().uri(uri.toString()).retrieve().body(JsonNode.class);
	}

	@GetMapping("/history/points/{pointId}")
	public JsonNode history(
			@PathVariable("pointId") String pointId,
			@RequestParam("type") String type,
			@RequestParam("from") String from,
			@RequestParam("to") String to) {
		String uri = "/api/history/points/" + pointId + "?type=" + type + "&from=" + from + "&to=" + to;
		return metier.get().uri(uri).retrieve().body(JsonNode.class);
	}

	@GetMapping("/alerts")
	public JsonNode alerts(@RequestParam(name = "status", required = false) String status,
			@RequestParam(name = "departementId", required = false) String departementId) {
		boolean hasStatus = status != null && !status.isBlank();
		boolean hasDept = departementId != null && !departementId.isBlank();
		if (hasStatus && hasDept) {
			return metier.get().uri("/api/alerts?status={s}&departementId={d}", status, departementId).retrieve().body(JsonNode.class);
		}
		if (hasStatus) {
			return metier.get().uri("/api/alerts?status={s}", status).retrieve().body(JsonNode.class);
		}
		if (hasDept) {
			return metier.get().uri("/api/alerts?departementId={d}", departementId).retrieve().body(JsonNode.class);
		}
		return metier.get().uri("/api/alerts").retrieve().body(JsonNode.class);
	}

	@PostMapping("/alerts")
	@ResponseStatus(HttpStatus.CREATED)
	public JsonNode createAlert(@RequestBody Map<String, Object> body) {
		return metier.post().uri("/api/alerts").body(body).retrieve().body(JsonNode.class);
	}

	@PostMapping("/alerts/{id}/ack")
	public JsonNode ack(@PathVariable("id") Long id) {
		return metier.post().uri("/api/alerts/{id}/ack", id).retrieve().body(JsonNode.class);
	}

	@GetMapping("/tickets")
	public JsonNode tickets(@RequestParam(name = "departementId", required = false) String departementId,
			@RequestParam(name = "kind", required = false) String kind) {
		boolean hasDept = departementId != null && !departementId.isBlank();
		boolean hasKind = kind != null && !kind.isBlank();
		if (hasDept && hasKind) {
			return metier.get().uri("/api/tickets?departementId={d}&kind={k}", departementId, kind).retrieve().body(JsonNode.class);
		}
		if (hasDept) {
			return metier.get().uri("/api/tickets?departementId={d}", departementId).retrieve().body(JsonNode.class);
		}
		if (hasKind) {
			return metier.get().uri("/api/tickets?kind={k}", kind).retrieve().body(JsonNode.class);
		}
		return metier.get().uri("/api/tickets").retrieve().body(JsonNode.class);
	}

	@PostMapping("/tickets")
	public JsonNode createTicket(@RequestBody Map<String, Object> body) {
		return metier.post().uri("/api/tickets").body(body).retrieve().body(JsonNode.class);
	}

	@PostMapping("/tickets/{id}/advance")
	public JsonNode advanceTicket(@PathVariable("id") Long id) {
		return metier.post().uri("/api/tickets/{id}/advance", id).retrieve().body(JsonNode.class);
	}

	@PostMapping("/tickets/{id}/assign")
	public JsonNode assignTicket(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
		return metier.post().uri("/api/tickets/{id}/assign", id).body(body).retrieve().body(JsonNode.class);
	}

	// ── Ordre de travail (intervention superviseur → technicien) ─────────────────

	@PostMapping("/tickets/intervention")
	public JsonNode creerIntervention(@RequestBody Map<String, Object> body) {
		return metier.post().uri("/api/tickets/intervention").body(body).retrieve().body(JsonNode.class);
	}

	@PostMapping("/tickets/{id}/envoyer")
	public JsonNode envoyerIntervention(@PathVariable("id") Long id) {
		return metier.post().uri("/api/tickets/{id}/envoyer", id).retrieve().body(JsonNode.class);
	}

	@PostMapping("/tickets/{id}/accepter")
	public JsonNode accepterIntervention(@PathVariable("id") Long id) {
		return metier.post().uri("/api/tickets/{id}/accepter", id).retrieve().body(JsonNode.class);
	}

	@PostMapping("/tickets/{id}/refuser")
	public JsonNode refuserIntervention(@PathVariable("id") Long id, @RequestBody(required = false) Map<String, Object> body) {
		return metier.post().uri("/api/tickets/{id}/refuser", id).body(body == null ? Map.of() : body).retrieve().body(JsonNode.class);
	}

	@PostMapping("/tickets/{id}/demarrer")
	public JsonNode demarrerIntervention(@PathVariable("id") Long id) {
		return metier.post().uri("/api/tickets/{id}/demarrer", id).retrieve().body(JsonNode.class);
	}

	@PostMapping("/tickets/{id}/terminer")
	public JsonNode terminerIntervention(@PathVariable("id") Long id) {
		return metier.post().uri("/api/tickets/{id}/terminer", id).retrieve().body(JsonNode.class);
	}

	// Validation superviseur (fiche d'intervention, bloc K).
	@PostMapping("/tickets/{id}/valider")
	public JsonNode validerIntervention(@PathVariable("id") Long id, @RequestBody(required = false) Map<String, Object> body) {
		return metier.post().uri("/api/tickets/{id}/valider", id).body(body == null ? Map.of() : body).retrieve().body(JsonNode.class);
	}

	@PostMapping("/tickets/{id}/corriger")
	public JsonNode corrigerIntervention(@PathVariable("id") Long id, @RequestBody(required = false) Map<String, Object> body) {
		return metier.post().uri("/api/tickets/{id}/corriger", id).body(body == null ? Map.of() : body).retrieve().body(JsonNode.class);
	}

	@PostMapping("/tickets/{id}/cloturer")
	public JsonNode cloturerIntervention(@PathVariable("id") Long id) {
		return metier.post().uri("/api/tickets/{id}/cloturer", id).retrieve().body(JsonNode.class);
	}

	@GetMapping("/tickets/{id}/taches")
	public JsonNode tachesIntervention(@PathVariable("id") Long id) {
		return metier.get().uri("/api/tickets/{id}/taches", id).retrieve().body(JsonNode.class);
	}

	// Affectation de techniciens sur l'intervention (étape Équipe du wizard + dispo dérivée).
	@PostMapping("/tickets/{id}/affecter")
	public JsonNode affecter(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
		return metier.post().uri("/api/tickets/{id}/affecter", id).body(body).retrieve().body(JsonNode.class);
	}

	@PostMapping("/tickets/{id}/liberer")
	public JsonNode liberer(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
		return metier.post().uri("/api/tickets/{id}/liberer", id).body(body).retrieve().body(JsonNode.class);
	}

	@GetMapping("/tickets/{id}/affectations")
	public JsonNode affectationsDe(@PathVariable("id") Long id) {
		return metier.get().uri("/api/tickets/{id}/affectations", id).retrieve().body(JsonNode.class);
	}

	@GetMapping("/tickets/affectations/ouvertes")
	public JsonNode affectationsOuvertes() {
		return metier.get().uri("/api/tickets/affectations/ouvertes").retrieve().body(JsonNode.class);
	}

	// Photos (preuves terrain) — upload multipart relayé vers api-metier, contenu binaire en flux.
	@PostMapping(value = "/tickets/{id}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public JsonNode uploadPhoto(@PathVariable("id") Long id,
			@RequestParam("file") MultipartFile file,
			@RequestParam("type") String type,
			@RequestParam(value = "commentaire", required = false) String commentaire,
			@RequestParam(value = "lat", required = false) String lat,
			@RequestParam(value = "lon", required = false) String lon) throws IOException {
		MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
		final String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "photo";
		body.add("file", new ByteArrayResource(file.getBytes()) {
			@Override public String getFilename() { return filename; }
		});
		body.add("type", type);
		if (commentaire != null) body.add("commentaire", commentaire);
		if (lat != null) body.add("lat", lat);
		if (lon != null) body.add("lon", lon);
		return metier.post().uri("/api/tickets/{id}/photos", id)
				.contentType(MediaType.MULTIPART_FORM_DATA).body(body).retrieve().body(JsonNode.class);
	}

	@GetMapping("/tickets/{id}/photos")
	public JsonNode photosDe(@PathVariable("id") Long id) {
		return metier.get().uri("/api/tickets/{id}/photos", id).retrieve().body(JsonNode.class);
	}

	@GetMapping("/tickets/{id}/photos/{photoId}/contenu")
	public ResponseEntity<byte[]> photoContenu(@PathVariable("id") Long id, @PathVariable("photoId") Long photoId) {
		ResponseEntity<byte[]> r = metier.get().uri("/api/tickets/{id}/photos/{p}/contenu", id, photoId)
				.retrieve().toEntity(byte[].class);
		MediaType ct = r.getHeaders().getContentType();
		return ResponseEntity.ok().contentType(ct != null ? ct : MediaType.APPLICATION_OCTET_STREAM).body(r.getBody());
	}

	@PatchMapping("/tickets/{id}/taches/{tacheId}")
	public JsonNode majTacheIntervention(@PathVariable("id") Long id, @PathVariable("tacheId") Long tacheId,
			@RequestBody Map<String, Object> body) {
		return metier.patch().uri("/api/tickets/{id}/taches/{tacheId}", id, tacheId).body(body).retrieve().body(JsonNode.class);
	}

	@GetMapping("/process-definitions")
	public Object processDefinitions() {
		try {
			return camundaApi.get().uri("/api/process-definitions").retrieve().body(JsonNode.class);
		} catch (Exception e) {
			return java.util.List.of();
		}
	}

	@PostMapping("/process-instances/{key}/start")
	public Object startProcess(@PathVariable("key") String key, @RequestBody(required = false) Map<String, Object> body) {
		try {
			return camundaApi.post()
					.uri("/api/process-instances/{key}/start", key)
					.body(body == null ? Map.of() : body)
					.retrieve()
					.body(JsonNode.class);
		} catch (Exception e) {
			return Map.of("status", "DOWN", "error", e.getClass().getSimpleName());
		}
	}

	@GetMapping("/tasks")
	public Object tasks(@RequestParam("processInstanceId") String processInstanceId) {
		try {
			return camundaApi.get()
					.uri("/api/tasks?processInstanceId={id}", processInstanceId)
					.retrieve()
					.body(JsonNode.class);
		} catch (Exception e) {
			return java.util.List.of();
		}
	}

	@PostMapping("/tasks/{id}/complete")
	public void completeTask(@PathVariable("id") String taskId, @RequestBody(required = false) Map<String, Object> body) {
		try {
			camundaApi.post()
					.uri("/api/tasks/{id}/complete", taskId)
					.body(body == null ? Map.of() : body)
					.retrieve()
					.toBodilessEntity();
		} catch (Exception ignored) {
			// no-op
		}
	}

	@GetMapping("/reference/points")
	public JsonNode referencePoints() {
		return metier.get().uri("/api/reference/points").retrieve().body(JsonNode.class);
	}

	@PutMapping("/reference/points/{id}")
	public JsonNode upsertReferencePoint(@PathVariable("id") String id, @RequestBody Map<String, Object> body) {
		return metier.put().uri("/api/reference/points/{id}", id).body(body).retrieve().body(JsonNode.class);
	}

	@DeleteMapping("/reference/points/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteReferencePoint(@PathVariable("id") String id) {
		metier.delete().uri("/api/reference/points/{id}", id).retrieve().toBodilessEntity();
	}

	@GetMapping("/reference/thresholds")
	public JsonNode referenceThresholds() {
		return metier.get().uri("/api/reference/thresholds").retrieve().body(JsonNode.class);
	}

	@PutMapping("/reference/thresholds/{type}")
	public JsonNode upsertThreshold(@PathVariable("type") String type, @RequestBody Map<String, Object> body) {
		return metier.put()
				.uri("/api/reference/thresholds/{type}", type)
				.body(body)
				.retrieve()
				.body(JsonNode.class);
	}

	@GetMapping("/reference/codelists")
	public JsonNode referenceCodeLists() {
		return metier.get().uri("/api/reference/codelists").retrieve().body(JsonNode.class);
	}

	@GetMapping("/reference/codelists/{listName}")
	public JsonNode referenceCodeList(@PathVariable("listName") String listName) {
		return metier.get().uri("/api/reference/codelists/{listName}", listName).retrieve().body(JsonNode.class);
	}

	@PutMapping("/reference/codelists/{listName}/{code}")
	public JsonNode upsertCodeItem(
			@PathVariable("listName") String listName,
			@PathVariable("code") String code,
			@RequestBody Map<String, Object> body) {
		return metier.put()
				.uri("/api/reference/codelists/{listName}/{code}", listName, code)
				.body(body)
				.retrieve()
				.body(JsonNode.class);
	}

	@DeleteMapping("/reference/codelists/{listName}/{code}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteCodeItem(@PathVariable("listName") String listName, @PathVariable("code") String code) {
		metier.delete().uri("/api/reference/codelists/{listName}/{code}", listName, code).retrieve().toBodilessEntity();
	}

	private Object safeGetJson(RestClient client, String uri) {
		try {
			return client.get().uri(uri).retrieve().body(JsonNode.class);
		} catch (Exception e) {
			return Map.of("status", "DOWN", "error", e.getClass().getSimpleName());
		}
	}
}
