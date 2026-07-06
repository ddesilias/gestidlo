package com.example.api_metier.web;

import com.example.api_metier.domain.NotificationEntity;
import com.example.api_metier.domain.RapportEntity;
import com.example.api_metier.domain.RapportSignatureEntity;
import com.example.api_metier.domain.RapportStatus;
import com.example.api_metier.repo.NotificationRepository;
import com.example.api_metier.repo.RapportRepository;
import com.example.api_metier.repo.RapportSignatureRepository;
import com.example.api_metier.repo.UserProfileRepository;
import com.example.api_metier.service.RapportRedactionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
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

/**
 * Rapports, scopés à l'URD. La règle de scope est la même que partout : un superviseur ne
 * voit/agit que sur le département de SON token, jamais le national, jamais une autre URD.
 *
 * <p>Circuit terrain (le cœur du module) : le technicien <b>soumet</b> (BROUILLON → TRANSMIS,
 * l'inbox « à valider »), le superviseur <b>valide</b> (TRANSMIS → VALIDE) puis <b>signe et
 * transmet</b> à l'admin (VALIDE → TRANSMIS_ADMIN) — il est un relais signataire, pas un terminus.
 * Un <b>renvoi</b> repart en BROUILLON avec motif. Chaque transition pousse une notification à
 * l'inverse du read-scope (fan-out), exactement comme les cycles Ouvrage / Capteur / Ressource.
 * Gestes : on persiste l'état d'abord, l'UI suit.
 */
@RestController
@RequestMapping("/api/rapports")
@PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD','OPERATOR','TEPAC')")
public class RapportController {

	private static final ObjectMapper SNAPSHOT_MAPPER = new ObjectMapper();

	private final RapportRepository rapports;
	private final RapportSignatureRepository signatures;
	private final TerritorialScope scope;
	private final RapportRedactionService redaction;
	private final UserProfileRepository profiles;
	private final NotificationRepository notifications;
	private final NotificationStream stream;

	public RapportController(RapportRepository rapports, RapportSignatureRepository signatures,
			TerritorialScope scope, RapportRedactionService redaction, UserProfileRepository profiles,
			NotificationRepository notifications, NotificationStream stream) {
		this.rapports = rapports;
		this.signatures = signatures;
		this.scope = scope;
		this.redaction = redaction;
		this.profiles = profiles;
		this.notifications = notifications;
		this.stream = stream;
	}

	@GetMapping
	public List<RapportResponse> list(
			@RequestParam(required = false) String departementId,
			@RequestParam(required = false) RapportStatus status,
			Authentication auth) {

		// Périmètre imposé par le token (résolveur partagé). Le rapport porte departementId + commune.
		TerritorialScope.Scope s = scope.resolve(auth);
		List<RapportEntity> rows;
		switch (s.niveau()) {
			case NATIONAL:
				if (departementId != null && !departementId.isBlank()) {
					rows = (status == null)
							? rapports.findByNationalFalseAndDepartementId(departementId)
							: rapports.findByNationalFalseAndDepartementIdAndStatus(departementId, status);
				} else {
					// Vue nationale (admin sans département) : tout, y compris les nationaux.
					rows = (status == null) ? rapports.findAll() : rapports.findByStatus(status);
				}
				break;
			case DEPARTEMENT:
				rows = (status == null)
						? rapports.findByNationalFalseAndDepartementId(s.departement())
						: rapports.findByNationalFalseAndDepartementIdAndStatus(s.departement(), status);
				break;
			case COMMUNE:
				rows = (status == null)
						? rapports.findByNationalFalseAndDepartementIdAndCommuneIgnoreCase(s.departement(), s.commune())
						: rapports.findByNationalFalseAndDepartementIdAndCommuneIgnoreCaseAndStatus(s.departement(), s.commune(), status);
				break;
			case AUCUN:
			default:
				rows = List.of();
		}
		return rows.stream().map(this::toResponse).toList();
	}

	/**
	 * Création d'un BROUILLON par l'auteur (TEPAC, superviseur ou admin). Le périmètre est imposé
	 * par le token : un TEPAC écrit sur SA commune, un superviseur sur SON département. Si un
	 * {@code contenuJson} guidé est fourni, le résumé professionnel est généré côté serveur
	 * (déterministe). L'auteur transmet ensuite via {@code /transmettre} pour entrer en file de
	 * validation.
	 */
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@Transactional
	public RapportResponse creer(@RequestBody CreerRapportRequest req, Authentication auth) {
		if (req == null || req.titre() == null || req.titre().isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le titre du rapport est requis");
		}
		TerritorialScope.Scope s = scope.resolve(auth);
		String dept, commune;
		switch (s.niveau()) {
			case NATIONAL:    dept = blankToNull(req.departement()); commune = blankToNull(req.commune()); break;
			case DEPARTEMENT: dept = s.departement();                commune = blankToNull(req.commune()); break;
			case COMMUNE:     dept = s.departement();                commune = s.commune();                break;
			default: throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Hors de votre périmètre");
		}
		String type = firstNonBlank(req.type(), "mensuel");
		RapportEntity r = new RapportEntity(
				null, req.titre().trim(), type, RapportStatus.BROUILLON,
				dept, false, commune, auteurNom(auth), auth != null ? auth.getName() : null, req.pages(), null);

		// Contenu terrain : on stocke les choix guidés et on rédige le texte pro (zéro LLM).
		String contenu = blankToNull(req.contenuJson());
		if (contenu != null) {
			r.setContenuJson(contenu);
			r.setResumeAuto(redaction.generer(type, commune, contenu));
		}
		// Lien dur vers l'intervention (ticket) pour un rapport d'intervention — chaîne tracée par ID.
		if (req.interventionId() != null) {
			r.setInterventionId(req.interventionId());
		}
		return toResponse(rapports.save(r));
	}

	/**
	 * L'auteur transmet SON brouillon → TRANSMIS (entre dans la file « à valider » du superviseur).
	 * Fan-out : on notifie ceux qui ont autorité de validation sur le département.
	 */
	@PostMapping("/{id}/transmettre")
	@Transactional
	public RapportResponse transmettre(@PathVariable String id, Authentication auth) {
		RapportEntity r = rapports.findById(id)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Rapport introuvable"));
		if (auth == null || !auth.getName().equals(r.getAuteurUsername())) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Seul l'auteur peut transmettre ce brouillon");
		}
		if (r.getStatus() != RapportStatus.BROUILLON) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Seul un brouillon peut être transmis");
		}
		r.setStatus(RapportStatus.TRANSMIS);
		r.setTransmisLe(Instant.now());
		rapports.save(r);

		// Notifie les validateurs du dept (admins + superviseurs URD), jamais les autres TEPAC.
		if (r.getDepartementId() != null) {
			String titre = "Rapport à valider — " + (r.getCommune() != null ? r.getCommune() : r.getDepartementId());
			String corps = r.getTitre() + " · soumis par " + r.getAuteur();
			fanout(profiles.validateursDuDept(r.getDepartementId(), auth.getName()),
					"RAPPORT_ATTENTE", titre, corps, r.getCommune());
		}
		return toResponse(r);
	}

	/**
	 * Le superviseur valide un rapport transmis (TRANSMIS → VALIDE) et notifie l'auteur. C'est le
	 * premier des deux paliers : « jugé bon par l'URD ». L'acte gèle un <b>snapshot signé</b>
	 * (document technicien + couche d'examen, identité figée, hash) dans le registre
	 * {@link RapportSignatureEntity}. La transmission à DINEPA est le second palier — {@code signer()}.
	 */
	@PostMapping("/{id}/valider")
	@PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD')")
	@Transactional
	public RapportResponse valider(@PathVariable String id,
			@RequestBody(required = false) ValiderRequest req, Authentication auth) {
		RapportEntity r = scoped(id, auth);
		if (r.getStatus() != RapportStatus.TRANSMIS) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"Seul un rapport transmis peut être validé");
		}
		// Blocage auto-validation serveur : un superviseur ne valide jamais SON propre rapport.
		if (auth != null && auth.getName().equals(r.getAuteurUsername())) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN,
					"Vous ne pouvez pas valider votre propre rapport");
		}
		// Invariant TX (substitut à l'index partiel non généré par ddl-auto) : au plus une ACTIVE.
		if (signatures.existsByRapportIdAndEtat(id, RapportSignatureEntity.Etat.ACTIVE)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT,
					"Ce rapport porte déjà une signature active");
		}

		String username = auth != null ? auth.getName() : "system";
		Instant when = Instant.now();
		r.valider(username, when);
		rapports.save(r);

		// Gel : snapshot immuable + hash + identité figée (dept = clé de scope, urdId = identité).
		signatures.save(buildSignature(r, auth, username, when, req));

		notifierAuteur(r, "RAPPORT_VALIDE", "Rapport validé — " + r.getTitre(),
				"Votre rapport a été validé par le superviseur URD.");
		return toResponse(r);
	}

	/**
	 * Le superviseur signe le rapport validé et le transmet à l'admin national
	 * (VALIDE → TRANSMIS_ADMIN). C'est le relais signataire : fan-out vers les administrateurs.
	 */
	@PostMapping("/{id}/signer")
	@PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD')")
	@Transactional
	public RapportResponse signer(@PathVariable String id, Authentication auth) {
		RapportEntity r = scoped(id, auth);
		if (r.getStatus() != RapportStatus.VALIDE) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"Seul un rapport validé peut être signé et transmis à l'admin");
		}
		// Tripwire : le contenu ne doit pas avoir bougé entre valider() (gel) et signer() (engagement).
		RapportSignatureEntity sig = signatures.findByRapportIdAndEtat(id, RapportSignatureEntity.Etat.ACTIVE)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
						"Aucune signature active à engager — re-validation requise"));
		String actuel = sha256Hex(canonicalJson(r, sig.isAttCompletude(), sig.isAttCoherence(),
				sig.isAttTerritorialite(), sig.getPrioriteReevaluee(), sig.getCommentaire()));
		if (!sig.getContentHash().equals(actuel)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT,
					"Le contenu a changé depuis la validation — re-validation requise");
		}
		r.signerEtTransmettre(auth != null ? auth.getName() : "system", auteurNom(auth), Instant.now());
		rapports.save(r);

		String titre = "Rapport URD validé reçu — " + (r.getCommune() != null ? r.getCommune() : r.getDepartementId());
		String corps = r.getTitre() + " · signé par " + r.getSignataire();
		fanout(profiles.adminsNationaux(auth != null ? auth.getName() : ""),
				"RAPPORT_TRANSMIS", titre, corps, r.getCommune());
		return toResponse(r);
	}

	/** Le superviseur renvoie un rapport transmis pour correction (TRANSMIS → BROUILLON + motif). */
	@PostMapping("/{id}/renvoyer")
	@PreAuthorize("hasAnyRole('ADMIN','SUPERVISEUR_URD')")
	@Transactional
	public RapportResponse renvoyer(@PathVariable String id, @RequestBody RenvoyerRequest req, Authentication auth) {
		RapportEntity r = scoped(id, auth);
		if (r.getStatus() != RapportStatus.TRANSMIS) {
			throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
					"Seul un rapport transmis peut être renvoyé");
		}
		if (req == null || req.motif() == null || req.motif().isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un motif est requis pour renvoyer (jamais muet)");
		}
		r.setStatus(RapportStatus.BROUILLON); // repart chez l'auteur avec le motif
		r.setMotifRenvoi(req.motif().trim());
		rapports.save(r);
		notifierAuteur(r, "RAPPORT_CORRECTION", "Correction demandée — " + r.getTitre(),
				"Motif : " + req.motif().trim());
		return toResponse(r);
	}

	// ── Helpers ──────────────────────────────────────────────────────────────

	/** Charge un rapport en vérifiant qu'il est dans le périmètre du caller (sinon 403/404). */
	private RapportEntity scoped(String id, Authentication auth) {
		RapportEntity r = rapports.findById(id)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Rapport introuvable"));
		if (SecurityScope.isSupervisor(auth)) {
			String dept = SecurityScope.tokenDept(auth);
			if (r.isNational() || dept == null || !dept.equalsIgnoreCase(r.getDepartementId())) {
				throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Hors de votre périmètre");
			}
		}
		return r;
	}

	/** Fan-out vers une liste de destinataires : persiste + pousse en SSE. */
	private void fanout(List<String> cibles, String type, String titre, String corps, String commune) {
		Instant now = Instant.now();
		for (String username : cibles) {
			NotificationEntity n = notifications.save(new NotificationEntity(
					username, type, titre, corps, null, commune, now));
			stream.push(username, NotificationStream.payload(n.getId(), titre, null));
		}
	}

	/** Notifie l'unique auteur du rapport (décision de validation / demande de correction). */
	private void notifierAuteur(RapportEntity r, String type, String titre, String corps) {
		String dest = r.getAuteurUsername();
		if (dest == null || dest.isBlank()) return;
		fanout(List.of(dest), type, titre, corps, r.getCommune());
	}

	/**
	 * Construit le snapshot signé : identité figée (dept = clé de scope, urdId = identité institutionnelle,
	 * tous deux lus du token), couche d'examen, et hash du contenu canonique. La signature est ACTIVE
	 * dès la création — SUPERSEDEE n'a pas de déclencheur.
	 */
	private RapportSignatureEntity buildSignature(RapportEntity r, Authentication auth,
			String username, Instant when, ValiderRequest req) {
		boolean attC   = req != null && Boolean.TRUE.equals(req.attCompletude());
		boolean attCoh = req != null && Boolean.TRUE.equals(req.attCoherence());
		boolean attT   = req != null && Boolean.TRUE.equals(req.attTerritorialite());
		String prio    = req != null ? blankToNull(req.prioriteReevaluee()) : null;
		String comm    = req != null ? blankToNull(req.commentaire()) : null;

		String snapshot = canonicalJson(r, attC, attCoh, attT, prio, comm);
		return new RapportSignatureEntity(
				r.getId(), username, auteurNom(auth),
				claim(auth, "dept"), claim(auth, "urdId"), principalRole(auth),
				sha256Hex(snapshot), snapshot,
				attC, attCoh, attT, prio, comm, when);
	}

	/**
	 * Représentation canonique et déterministe du contenu gelé (document technicien + couche
	 * d'examen). L'ordre des champs est fixe (LinkedHashMap) — c'est sur CETTE chaîne exacte que
	 * porte le hash, et c'est elle qu'on stocke en {@code snapshotJson}.
	 */
	private static String canonicalJson(RapportEntity r, boolean attC, boolean attCoh, boolean attT,
			String prio, String comm) {
		Map<String, Object> m = new LinkedHashMap<>();
		m.put("titre", nz(r.getTitre()));
		m.put("type", nz(r.getType()));
		m.put("departementId", nz(r.getDepartementId()));
		m.put("commune", nz(r.getCommune()));
		m.put("interventionId", r.getInterventionId());
		m.put("contenuJson", nz(r.getContenuJson()));
		m.put("resumeAuto", nz(r.getResumeAuto()));
		m.put("attCompletude", attC);
		m.put("attCoherence", attCoh);
		m.put("attTerritorialite", attT);
		m.put("prioriteReevaluee", nz(prio));
		m.put("commentaire", nz(comm));
		try {
			return SNAPSHOT_MAPPER.writeValueAsString(m);
		} catch (Exception e) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Sérialisation du snapshot impossible");
		}
	}

	private static String sha256Hex(String s) {
		try {
			byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
			StringBuilder sb = new StringBuilder(64);
			for (byte b : d) sb.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
			return sb.toString();
		} catch (Exception e) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Hash du snapshot impossible");
		}
	}

	private static String claim(Authentication auth, String name) {
		if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
			String v = jwt.getClaimAsString(name);
			return (v == null || v.isBlank()) ? null : v;
		}
		return null;
	}

	private static String principalRole(Authentication auth) {
		if (auth == null) return null;
		for (var ga : auth.getAuthorities()) {
			String a = ga.getAuthority();
			if ("ROLE_SUPERVISEUR_URD".equals(a)) return "SUPERVISEUR_URD";
			if ("ROLE_ADMIN".equals(a)) return "ADMIN";
		}
		return null;
	}

	private static String nz(String s) { return s == null ? "" : s; }

	private RapportResponse toResponse(RapportEntity r) {
		return new RapportResponse(
				r.getId(), r.getTitre(), r.getType(), r.getStatus(),
				r.getDepartementId(), r.isNational(), r.getCommune(),
				r.getAuteur(), r.getAuteurUsername(), r.getPages(),
				r.getTransmisLe() != null ? r.getTransmisLe().toString() : null,
				r.getMotifRenvoi(),
				r.getContenuJson(), r.getResumeAuto(),
				r.getValidePar(), r.getValideLe() != null ? r.getValideLe().toString() : null,
				r.getSignataire(), r.getSigneLe() != null ? r.getSigneLe().toString() : null,
				r.getInterventionId(),
				r.getCreatedAt() != null ? r.getCreatedAt().toString() : null);
	}

	private static String auteurNom(Authentication auth) {
		if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
			String nom = jwt.getClaimAsString("nom");
			if (nom != null && !nom.isBlank()) return nom;
		}
		return auth != null ? auth.getName() : "—";
	}

	private static String blankToNull(String s) {
		return (s == null || s.isBlank()) ? null : s.trim();
	}

	private static String firstNonBlank(String a, String b) {
		return (a != null && !a.isBlank()) ? a.trim() : b;
	}

	// ── Records ──────────────────────────────────────────────────────────────

	public record CreerRapportRequest(String titre, String type, String commune, String departement,
			Integer pages, String contenuJson, Long interventionId) {}

	public record RenvoyerRequest(String motif) {}

	/** Couche d'examen du superviseur, gelée dans le snapshot signé à la validation. */
	public record ValiderRequest(Boolean attCompletude, Boolean attCoherence, Boolean attTerritorialite,
			String prioriteReevaluee, String commentaire) {}

	public record RapportResponse(
			String id, String titre, String type, RapportStatus status,
			String departementId, boolean national, String commune,
			String auteur, String auteurUsername, Integer pages,
			String transmisLe, String motifRenvoi,
			String contenuJson, String resumeAuto,
			String validePar, String valideLe,
			String signataire, String signeLe,
			Long interventionId,
			String createdAt) {}
}
