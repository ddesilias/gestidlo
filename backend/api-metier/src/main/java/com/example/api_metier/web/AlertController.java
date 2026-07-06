package com.example.api_metier.web;

import com.example.api_metier.domain.AlertEntity;
import com.example.api_metier.domain.AlertSeverity;
import com.example.api_metier.domain.AlertStatus;
import com.example.api_metier.domain.NotificationEntity;
import com.example.api_metier.repo.AlertRepository;
import com.example.api_metier.repo.NotificationRepository;
import com.example.api_metier.repo.UserProfileRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/alerts")
public class AlertController {

	private final AlertRepository alerts;
	private final UserProfileRepository profiles;
	private final NotificationRepository notifications;
	private final NotificationStream stream;
	private final TerritorialScope scope;

	public AlertController(AlertRepository alerts, UserProfileRepository profiles,
			NotificationRepository notifications, NotificationStream stream, TerritorialScope scope) {
		this.alerts        = alerts;
		this.profiles      = profiles;
		this.notifications = notifications;
		this.stream        = stream;
		this.scope         = scope;
	}

	@GetMapping
	public List<AlertEntity> list(
			@RequestParam(name = "status", required = false) AlertStatus status,
			@RequestParam(name = "departementId", required = false) String departementId,
			Authentication authentication) {

		// Périmètre imposé par le token via le résolveur partagé (jamais le param client).
		// status absent => tous les statuts (l'inbox de triage charge les 3 segments d'un coup).
		TerritorialScope.Scope s = scope.resolve(authentication);
		switch (s.niveau()) {
			case DEPARTEMENT:
				// Superviseur verrouillé sur SON département.
				String dept = s.departement();
				return status == null ? alerts.findByDepartement(dept) : alerts.findByStatusAndDepartement(status, dept);
			case NATIONAL:
				// Admin : vue globale, avec drill-down optionnel par departementId.
				if (departementId != null && !departementId.isBlank()) {
					return status == null ? alerts.findByDepartement(departementId) : alerts.findByStatusAndDepartement(status, departementId);
				}
				return status == null ? alerts.findAll() : alerts.findByStatus(status);
			case COMMUNE:
				// TEPAC : verrouillé sur SA commune (colonne dénormalisée sur l'alerte).
				String commune = s.commune();
				return status == null ? alerts.findByCommuneIgnoreCase(commune) : alerts.findByStatusAndCommuneIgnoreCase(status, commune);
			case AUCUN:
			default:
				return List.of();
		}
	}

	/**
	 * Création manuelle d'une alerte (modale partagée). Le serveur revérifie le périmètre
	 * ({@link #peutCreerSur}) — le verrou front n'est que du confort. La commune est
	 * dénormalisée sur l'alerte (même champ que le read-scope), puis le fan-out notifie tous
	 * ceux dont le périmètre couvre cette commune.
	 */
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@Transactional
	public AlertEntity create(@RequestBody CreateAlertRequest req, Authentication auth) {
		if (req.titre() == null || req.titre().isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le titre de l'alerte est requis");
		}
		if (req.commune() == null || req.commune().isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La commune est requise");
		}
		String dept    = blankToNull(req.departement());
		String commune = req.commune().trim();

		// Garde-fou périmètre : un superviseur ne crée que dans son dept, un TEPAC que dans sa
		// commune ; l'admin partout. Forger un payload hors périmètre → 403.
		TerritorialScope.Scope s = scope.resolve(auth);
		if (!peutCreerSur(s, dept, commune)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Hors de votre périmètre");
		}

		Instant now = Instant.now();
		// pointId/sensorId sont obligatoires sur l'alerte : pour une création manuelle (sans capteur),
		// on retombe sur l'infrastructure puis un marqueur « MANUEL ».
		String pointId  = firstNonBlank(req.pointId(), req.infraId(), "MANUEL");
		String sensorId = firstNonBlank(req.sensorId(), "MANUEL");
		AlertEntity alert = new AlertEntity(
				pointId, sensorId, firstNonBlank(req.type(), "MANUEL"),
				mapSeverite(req.severite()), AlertStatus.ACTIVE, req.titre().trim(), now, now, commune);
		// Lien dur vers la ressource d'origine (alerte née d'une ressource menacée/polluée).
		if (req.ressourceId() != null && !req.ressourceId().isBlank()) {
			alert.setRessourceId(req.ressourceId().trim());
		}
		alert = alerts.save(alert);

		fanOut(alert, dept, auth != null ? auth.getName() : "");
		return alert;
	}

	@PostMapping("/{id}/ack")
	public AlertEntity ack(@PathVariable("id") Long id) {
		AlertEntity alert = alerts.findById(id).orElseThrow();
		alert.setStatus(AlertStatus.ACK);
		alert.setUpdatedAt(Instant.now());
		return alerts.save(alert);
	}

	// ── Fan-out + garde-fou ────────────────────────────────────────────────────

	/** Notifie tous ceux dont le périmètre couvre la commune de l'alerte (inverse du read-scope). */
	private void fanOut(AlertEntity alert, String dept, String creator) {
		List<String> cibles = profiles.destinatairesAlerte(
				dept == null ? "" : dept,
				alert.getCommune() == null ? "" : alert.getCommune(),
				creator == null ? "" : creator);
		Instant now = Instant.now();
		String titre = "Nouvelle alerte — " + alert.getCommune();
		for (String username : cibles) {
			NotificationEntity n = notifications.save(new NotificationEntity(
					username, "ALERTE", titre, alert.getMessage(), alert.getId(), alert.getCommune(), now));
			// Push SSE temps réel (en plus de la persistance) → la cloche s'allume immédiatement.
			stream.push(username, NotificationStream.payload(n.getId(), titre, alert.getId()));
		}
	}

	private static boolean peutCreerSur(TerritorialScope.Scope s, String dept, String commune) {
		switch (s.niveau()) {
			case NATIONAL:    return true;
			case DEPARTEMENT: return s.departement() != null && s.departement().equalsIgnoreCase(dept);
			case COMMUNE:     return s.commune() != null && s.commune().equalsIgnoreCase(commune);
			default:          return false;
		}
	}

	private static AlertSeverity mapSeverite(String s) {
		if (s == null) return AlertSeverity.WARN;
		switch (s.trim().toLowerCase()) {
			case "critique": case "crit":          return AlertSeverity.CRIT;
			case "basse":    case "info":          return AlertSeverity.INFO;
			default:                               return AlertSeverity.WARN;   // haute / moyenne / warn
		}
	}

	private static String blankToNull(String s) {
		return (s == null || s.isBlank()) ? null : s.trim();
	}

	private static String firstNonBlank(String... vals) {
		for (String v : vals) if (v != null && !v.isBlank()) return v.trim();
		return "MANUEL";
	}

	public record CreateAlertRequest(
			String titre, String description, String severite, String type,
			String departement, String commune, String infraId, String pointId, String sensorId,
			String ressourceId) {}
}
