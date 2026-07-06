package com.example.api_metier.web;

import com.example.api_metier.domain.ZoneEntity;
import com.example.api_metier.domain.ZoneStatus;
import com.example.api_metier.repo.ZoneRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Zones AEP, scopées au département. L'ACTIVATION est l'écriture la plus sensible d'un
 * superviseur — garde-fou non négociable : le serveur vérifie que le département de la
 * zone est celui du token. Un superviseur ne peut jamais activer une zone hors de son
 * périmètre, même en forgeant le payload. Même endpoint, même garde-fou côté admin.
 */
@RestController
@RequestMapping("/api/zones")
@PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD','OPERATOR')")
public class ZoneController {

	private final ZoneRepository zones;
	private final TerritorialScope scope;

	public ZoneController(ZoneRepository zones, TerritorialScope scope) {
		this.zones = zones;
		this.scope = scope;
	}

	@GetMapping
	public List<ZoneResponse> list(@RequestParam(required = false) String departementId, Authentication auth) {
		// Périmètre imposé par le token (résolveur partagé). Zone porte commune + departementId.
		TerritorialScope.Scope s = scope.resolve(auth);
		List<ZoneEntity> rows;
		switch (s.niveau()) {
			case NATIONAL:
				rows = (departementId != null && !departementId.isBlank()) ? zones.findByDepartementId(departementId) : zones.findAll();
				break;
			case DEPARTEMENT:
				rows = zones.findByDepartementId(s.departement());
				break;
			case COMMUNE:
				rows = zones.findByDepartementIdAndCommuneIgnoreCase(s.departement(), s.commune());
				break;
			case AUCUN:
			default:
				rows = List.of();
		}
		return rows.stream().map(this::toResponse).toList();
	}

	/** Créer + activer une zone (activation minimale : commune + nom + géométrie → active). */
	@PostMapping("/activer")
	@ResponseStatus(HttpStatus.CREATED)
	public ZoneResponse activer(@RequestBody ActiverZoneRequest req, Authentication auth) {
		if (req.nom() == null || req.nom().isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le nom de la zone est requis");
		}
		if (req.commune() == null || req.commune().isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La commune est requise");
		}

		// Le département est verrouillé sur le token : une zone forgée hors périmètre → 403.
		// (En PostGIS : ST_Intersects(geom, departement.geom). Ici : departementId == token.dept.)
		String dept = req.departementId();
		if (SecurityScope.isSupervisor(auth)) {
			String tokenDept = SecurityScope.tokenDept(auth);
			if (tokenDept == null || dept == null || !tokenDept.equalsIgnoreCase(dept)) {
				throw new ResponseStatusException(HttpStatus.FORBIDDEN,
						"Activation hors de votre périmètre départemental (" + tokenDept + ")");
			}
			dept = tokenDept;
		}
		if (dept == null || dept.isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le département est requis");
		}

		ZoneEntity z = new ZoneEntity(
				req.id(), req.code(), req.nom().trim(), req.commune().trim(), dept,
				req.geom(), ZoneStatus.ACTIVE, req.populationCible(),
				auth != null ? auth.getName() : null, Instant.now());
		return toResponse(zones.save(z));
	}

	/** Activer une zone existante (à_deployer → active), dans son périmètre. */
	@PostMapping("/{id}/activer")
	public ZoneResponse activerExistante(@PathVariable String id, Authentication auth) {
		ZoneEntity z = zones.findById(id)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zone introuvable"));
		enforceScope(z, auth);
		z.setStatut(ZoneStatus.ACTIVE);
		z.setActiveePar(auth != null ? auth.getName() : null);
		z.setDateActivation(Instant.now());
		return toResponse(zones.save(z));
	}

	// ── Helpers ──────────────────────────────────────────────────────────────

	private void enforceScope(ZoneEntity z, Authentication auth) {
		if (SecurityScope.isSupervisor(auth)) {
			String dept = SecurityScope.tokenDept(auth);
			if (dept == null || !dept.equalsIgnoreCase(z.getDepartementId())) {
				throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Hors de votre périmètre");
			}
		}
	}

	private ZoneResponse toResponse(ZoneEntity z) {
		return new ZoneResponse(
				z.getId(), z.getCode(), z.getNom(), z.getCommune(), z.getDepartementId(),
				z.getStatut(), z.getPopulationCible(), z.getActiveePar(),
				z.getDateActivation() != null ? z.getDateActivation().toString() : null);
	}

	// ── Records ──────────────────────────────────────────────────────────────

	public record ActiverZoneRequest(
			String id, String code, String nom, String commune, String departementId,
			String geom, Integer populationCible) {}

	public record ZoneResponse(
			String id, String code, String nom, String commune, String departementId,
			ZoneStatus statut, Integer populationCible, String activeePar, String dateActivation) {}
}
