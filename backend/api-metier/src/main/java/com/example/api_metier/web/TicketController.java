package com.example.api_metier.web;

import com.example.api_metier.domain.AffectationEntity;
import com.example.api_metier.domain.CommuneEntity;
import com.example.api_metier.domain.InterventionPhotoEntity;
import com.example.api_metier.domain.InterventionTacheEntity;
import com.example.api_metier.domain.NotificationEntity;
import com.example.api_metier.domain.TicketEntity;
import com.example.api_metier.domain.TicketKind;
import com.example.api_metier.domain.TicketStatus;
import com.example.api_metier.domain.UserProfileEntity;
import com.example.api_metier.repo.AffectationRepository;
import com.example.api_metier.repo.CommuneRepository;
import com.example.api_metier.repo.InterventionPhotoRepository;
import com.example.api_metier.repo.InterventionTacheRepository;
import com.example.api_metier.repo.NotificationRepository;
import com.example.api_metier.repo.TicketRepository;
import com.example.api_metier.repo.UserProfileRepository;
import com.example.api_metier.service.TicketService;
import com.example.api_metier.service.TicketService.CreateTicketRequest;
import com.example.api_metier.web.dto.AssignTicketRequest;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/tickets")
public class TicketController {

	private final TicketService ticketService;
	private final TicketRepository tickets;
	private final TerritorialScope scope;
	private final AffectationRepository affectations;
	private final UserProfileRepository profiles;
	private final CommuneRepository communes;
	private final InterventionTacheRepository taches;
	private final InterventionPhotoRepository photos;
	private final NotificationRepository notifications;
	private final NotificationStream stream;

	public TicketController(TicketService ticketService, TicketRepository tickets, TerritorialScope scope,
			AffectationRepository affectations, UserProfileRepository profiles, CommuneRepository communes,
			InterventionTacheRepository taches, InterventionPhotoRepository photos,
			NotificationRepository notifications, NotificationStream stream) {
		this.ticketService = ticketService;
		this.tickets = tickets;
		this.scope = scope;
		this.affectations = affectations;
		this.profiles = profiles;
		this.communes = communes;
		this.taches = taches;
		this.photos = photos;
		this.notifications = notifications;
		this.stream = stream;
	}

	@GetMapping
	public List<TicketEntity> list(
			@RequestParam(name = "status", required = false) TicketStatus status,
			@RequestParam(name = "kind", required = false) TicketKind kind,
			@RequestParam(name = "departementId", required = false) String departementId,
			Authentication authentication) {

		// Périmètre imposé par le token via le résolveur partagé. Le territoire d'un ticket est
		// dérivé du point (ticket.pointId → PointRefEntity.territory) : pas de colonne commune,
		// donc le niveau COMMUNE (TEPAC) est fail-closed tant que la dénormalisation n'est pas faite.
		TerritorialScope.Scope s = scope.resolve(authentication);
		List<TicketEntity> rows;
		switch (s.niveau()) {
			case DEPARTEMENT:
				rows = tickets.findByDepartement(s.departement());
				break;
			case NATIONAL:
				rows = (departementId != null && !departementId.isBlank())
						? tickets.findByDepartement(departementId)
						: tickets.findAll();
				break;
			case COMMUNE:
				// TEPAC : verrouillé sur SA commune (colonne dénormalisée sur le ticket).
				rows = tickets.findByCommuneIgnoreCase(s.commune());
				break;
			case AUCUN:
			default:
				return List.of();
		}
		return rows.stream()
				.filter(t -> status == null || t.getStatus() == status)
				// kind null sur les lignes historiques = ALERTE (rétro-rempli au démarrage).
				.filter(t -> kind == null || effectiveKind(t) == kind)
				.toList();
	}

	private static TicketKind effectiveKind(TicketEntity t) {
		return t.getKind() == null ? TicketKind.ALERTE : t.getKind();
	}

	@PostMapping
	public TicketEntity create(@RequestBody CreateTicketRequest request) {
		return ticketService.createTicket(request);
	}

	@PostMapping("/{id}/advance")
	public TicketEntity advance(@PathVariable("id") Long id) {
		return ticketService.advance(id);
	}

	@PostMapping("/{id}/assign")
	public TicketEntity assign(@PathVariable("id") Long id, @RequestBody AssignTicketRequest request) {
		return ticketService.assign(id, request.assignee());
	}

	// ── Affectation de personnes sur l'intervention (= ce ticket) ────────────────
	// Relation N:M ; la disponibilité d'une personne se DÉRIVE d'une affectation ouverte
	// (jamais stockée). Affecter = ouvrir ; Libérer = fermer. Boucle alerte → intervention → équipe.

	/** Affecte une personne à l'intervention (idempotent : pas de doublon ouvert). */
	@PostMapping("/{id}/affecter")
	@Transactional
	public AffectationResponse affecter(@PathVariable("id") Long id,
			@RequestBody AffecterRequest body, Authentication auth) {
		if (body == null || body.personneUsername() == null || body.personneUsername().isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "personneUsername est requis");
		}
		TicketEntity ticket = ticketInScope(id, auth);
		String username = body.personneUsername().trim();
		// Idempotence : si déjà affectée (ouverte), on renvoie l'affectation existante.
		AffectationEntity existante = affectations.findByTicketIdAndClosedAtIsNull(id).stream()
				.filter(a -> a.getPersonneUsername().equalsIgnoreCase(username)).findFirst().orElse(null);
		if (existante != null) return toResponse(existante);

		String nom = profiles.findById(username).map(UserProfileEntity::getNom).orElse(username);
		AffectationEntity a = new AffectationEntity(
				id, username, nom, ticket.getCommune(), Instant.now(),
				auth != null ? auth.getName() : "system");
		a.setRole(body.role());   // PRINCIPAL (défaut) | APPUI
		return toResponse(affectations.save(a));
	}

	/** Libère une personne de l'intervention (ferme son affectation ouverte). */
	@PostMapping("/{id}/liberer")
	@Transactional
	public AffectationResponse liberer(@PathVariable("id") Long id,
			@RequestBody AffecterRequest body, Authentication auth) {
		if (body == null || body.personneUsername() == null || body.personneUsername().isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "personneUsername est requis");
		}
		ticketInScope(id, auth);
		String username = body.personneUsername().trim();
		AffectationEntity a = affectations.findByTicketIdAndClosedAtIsNull(id).stream()
				.filter(x -> x.getPersonneUsername().equalsIgnoreCase(username)).findFirst()
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Aucune affectation ouverte pour cette personne"));
		a.fermer(Instant.now());
		return toResponse(affectations.save(a));
	}

	/** Affectations ouvertes d'une intervention. */
	@GetMapping("/{id}/affectations")
	public List<AffectationResponse> affectationsDe(@PathVariable("id") Long id, Authentication auth) {
		ticketInScope(id, auth);
		return affectations.findByTicketIdAndClosedAtIsNull(id).stream().map(this::toResponse).toList();
	}

	/**
	 * Toutes les affectations OUVERTES du périmètre (source de la disponibilité côté écran :
	 * une personne dont le username apparaît ici est « sur intervention »). Scopée par la commune
	 * dénormalisée de l'affectation — même logique que partout.
	 */
	@GetMapping("/affectations/ouvertes")
	public List<AffectationResponse> ouvertes(Authentication auth) {
		TerritorialScope.Scope s = scope.resolve(auth);
		List<AffectationEntity> open = affectations.findByClosedAtIsNull();
		switch (s.niveau()) {
			case NATIONAL:
				break;
			case DEPARTEMENT: {
				Set<String> dept = communesDuDept(s.departement());
				open = open.stream()
						.filter(a -> a.getCommune() != null && dept.contains(a.getCommune().toLowerCase()))
						.toList();
				break;
			}
			case COMMUNE:
				open = open.stream()
						.filter(a -> a.getCommune() != null && a.getCommune().equalsIgnoreCase(s.commune()))
						.toList();
				break;
			case AUCUN:
			default:
				return List.of();
		}
		return open.stream().map(this::toResponse).toList();
	}

	// ── Ordre de travail (intervention superviseur → technicien) ─────────────────

	/** Création d'une intervention par le superviseur (statut BROUILLON + checklist). */
	@PostMapping("/intervention")
	@Transactional
	public TicketEntity creerIntervention(@RequestBody CreateInterventionRequest req, Authentication auth) {
		if (req == null || blank(req.commune())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La commune est requise");
		}
		// Périmètre : un superviseur ne crée que dans son département ; le TEPAC ne crée pas d'ordre.
		TerritorialScope.Scope s = scope.resolve(auth);
		switch (s.niveau()) {
			case NATIONAL:
				break;
			case DEPARTEMENT:
				if (!communesDuDept(s.departement()).contains(req.commune().toLowerCase())) {
					throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Commune hors de votre périmètre");
				}
				break;
			default:
				throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Création d'intervention réservée au superviseur");
		}
		Instant now = Instant.now();
		// pointId/sensorId sont non-nuls en base : on les dérive de l'ouvrage/capteur (ou synthétiques).
		String pointId = blank(req.ouvrageId()) ? "MANUEL-" + req.commune() : req.ouvrageId();
		String sensorId = blank(req.capteurId()) ? "-" : req.capteurId();
		TicketEntity t = new TicketEntity(TicketStatus.BROUILLON, null, pointId, sensorId,
				blank(req.assignee()) ? null : req.assignee().trim(), now, now, req.commune().trim());
		t.setKind(TicketKind.ORDRE);   // ordre de travail : transitions manuelles, hors Camunda
		t.setTitre(blank(req.titre()) ? "Intervention " + req.commune() : req.titre().trim());
		t.setType(req.type());
		t.setPriorite(blank(req.priorite()) ? "normale" : req.priorite());
		t.setOuvrageId(blank(req.ouvrageId()) ? null : req.ouvrageId());
		t.setCapteurId(blank(req.capteurId()) ? null : req.capteurId());
		t.setSuperviseurId(auth != null ? auth.getName() : null);
		t.setDatePrevue(parseInstant(req.datePrevue()));
		t.setHeurePrevue(req.heurePrevue());
		t.setDureeMinutes(req.dureeMinutes());
		t.setConsignes(req.consignes());
		t.setResultatAttendu(req.resultatAttendu());
		t.setMateriel(req.materiel());
		t.setRisques(req.risques());
		TicketEntity saved = tickets.save(t);
		// Checklist : template posé par le superviseur (chaque ligne = une tâche cochable terrain).
		if (req.taches() != null) {
			int ordre = 0;
			for (TacheInput ti : req.taches()) {
				if (ti == null || blank(ti.libelle())) continue;
				taches.save(new InterventionTacheEntity(saved.getId(), ti.libelle().trim(),
						ti.obligatoire() != null && ti.obligatoire(), ordre++));
			}
		}
		return saved;
	}

	/** Envoi officiel au technicien : BROUILLON → ENVOYEE + fan-out notification. */
	@PostMapping("/{id}/envoyer")
	@Transactional
	public TicketEntity envoyer(@PathVariable("id") Long id, Authentication auth) {
		TicketEntity t = ticketInScope(id, auth);
		t.setStatus(TicketStatus.ENVOYEE);
		t.setUpdatedAt(Instant.now());
		TicketEntity saved = tickets.save(t);
		notifierAssignes(saved, "INTERVENTION_ENVOYEE",
				"Nouvelle intervention — " + (saved.getCommune() != null ? saved.getCommune() : ""),
				saved.getTitre());
		return saved;
	}

	/** Le technicien accepte : son affectation passe ACCEPTE ; le ticket → ACCEPTEE. */
	@PostMapping("/{id}/accepter")
	@Transactional
	public TicketEntity accepter(@PathVariable("id") Long id, Authentication auth) {
		TicketEntity t = ticketInScope(id, auth);
		marquerDecision(id, auth, "ACCEPTE");
		t.setStatus(TicketStatus.ACCEPTEE);
		t.setAcceptedAt(Instant.now());
		t.setUpdatedAt(Instant.now());
		return tickets.save(t);
	}

	/** Le technicien refuse avec motif : son affectation passe REFUSE ; le ticket → REJETEE. */
	@PostMapping("/{id}/refuser")
	@Transactional
	public TicketEntity refuser(@PathVariable("id") Long id,
			@RequestBody(required = false) MotifRequest body, Authentication auth) {
		TicketEntity t = ticketInScope(id, auth);
		marquerDecision(id, auth, "REFUSE");
		t.setStatus(TicketStatus.REJETEE);
		t.setMotifRejet(body != null ? body.motif() : null);
		t.setUpdatedAt(Instant.now());
		return tickets.save(t);
	}

	/** Le technicien démarre : → EN_COURS. */
	@PostMapping("/{id}/demarrer")
	@Transactional
	public TicketEntity demarrer(@PathVariable("id") Long id, Authentication auth) {
		TicketEntity t = ticketInScope(id, auth);
		t.setStatus(TicketStatus.EN_COURS);
		t.setStartedAt(Instant.now());
		t.setUpdatedAt(Instant.now());
		return tickets.save(t);
	}

	/** Le technicien termine : → TERMINEE (le rapport pourra ensuite être pré-rempli). */
	@PostMapping("/{id}/terminer")
	@Transactional
	public TicketEntity terminer(@PathVariable("id") Long id, Authentication auth) {
		TicketEntity t = ticketInScope(id, auth);
		t.setStatus(TicketStatus.TERMINEE);
		t.setCompletedAt(Instant.now());
		t.setUpdatedAt(Instant.now());
		return tickets.save(t);
	}

	// ── Validation superviseur (fiche d'intervention, bloc K) ────────────────────
	// Trois transitions réservées au superviseur, symétriques du cycle technicien.
	// L'auto-validation est bloquée : le technicien assigné ne valide pas sa propre
	// intervention (le contrôle sur le ticket reflète la règle du workflow rapport).

	/** Le superviseur valide le rapport terrain : TERMINEE/RAPPORT_SOUMIS → VALIDEE. */
	@PostMapping("/{id}/valider")
	@Transactional
	public TicketEntity valider(@PathVariable("id") Long id,
			@RequestBody(required = false) CommentaireRequest body, Authentication auth) {
		TicketEntity t = ticketInScope(id, auth);
		exigerSuperviseur(auth);
		if (auth != null && auth.getName().equalsIgnoreCase(t.getAssignee())) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN,
					"Auto-validation interdite : le technicien ne valide pas sa propre intervention");
		}
		t.setStatus(TicketStatus.VALIDEE);
		t.setValideePar(auth != null ? auth.getName() : null);
		t.setValideeAt(Instant.now());
		if (body != null && !blank(body.commentaire())) {
			t.setCommentaireValidation(body.commentaire().trim());
		}
		t.setUpdatedAt(Instant.now());
		TicketEntity saved = tickets.save(t);
		notifierAssignes(saved, "INTERVENTION_VALIDEE",
				"Rapport validé — " + safe(saved.getCommune()), saved.getTitre());
		return saved;
	}

	/** Le superviseur demande une correction : renvoie l'intervention au technicien (→ EN_COURS) avec motif. */
	@PostMapping("/{id}/corriger")
	@Transactional
	public TicketEntity corriger(@PathVariable("id") Long id,
			@RequestBody(required = false) MotifRequest body, Authentication auth) {
		TicketEntity t = ticketInScope(id, auth);
		exigerSuperviseur(auth);
		String motif = body != null ? body.motif() : null;
		if (blank(motif)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un motif de correction est requis");
		}
		t.setStatus(TicketStatus.EN_COURS);
		t.setCommentaireValidation(motif.trim());
		t.setUpdatedAt(Instant.now());
		TicketEntity saved = tickets.save(t);
		notifierAssignes(saved, "INTERVENTION_CORRECTION",
				"Correction demandée — " + safe(saved.getCommune()), motif.trim());
		return saved;
	}

	/** Le superviseur clôture l'intervention : → CLOSED (terminal). */
	@PostMapping("/{id}/cloturer")
	@Transactional
	public TicketEntity cloturer(@PathVariable("id") Long id, Authentication auth) {
		TicketEntity t = ticketInScope(id, auth);
		exigerSuperviseur(auth);
		t.setStatus(TicketStatus.CLOSED);
		t.setUpdatedAt(Instant.now());
		return tickets.save(t);
	}

	/** Réserve une action de validation au superviseur (DÉPARTEMENT/NATIONAL) : un TEPAC ne valide pas. */
	private void exigerSuperviseur(Authentication auth) {
		switch (scope.resolve(auth).niveau()) {
			case NATIONAL:
			case DEPARTEMENT:
				return;
			default:
				throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Validation réservée au superviseur");
		}
	}

	private static String safe(String s) {
		return s != null ? s : "";
	}

	/** Checklist de l'intervention (ordre stable). */
	@GetMapping("/{id}/taches")
	public List<InterventionTacheEntity> tachesDe(@PathVariable("id") Long id, Authentication auth) {
		ticketInScope(id, auth);
		return taches.findByTicketIdOrderByOrdreAsc(id);
	}

	/** Cocher / commenter une tâche (terrain). statut : A_FAIRE | FAIT | NON_APPLICABLE. */
	@PatchMapping("/{id}/taches/{tacheId}")
	@Transactional
	public InterventionTacheEntity majTache(@PathVariable("id") Long id, @PathVariable("tacheId") Long tacheId,
			@RequestBody TacheUpdate body, Authentication auth) {
		ticketInScope(id, auth);
		InterventionTacheEntity ta = taches.findById(tacheId).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tâche introuvable"));
		if (!ta.getTicketId().equals(id)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tâche d'une autre intervention");
		}
		if (body != null && body.statut() != null) {
			String st = body.statut().trim().toUpperCase();
			ta.setStatut(st);
			ta.setCompletedAt("FAIT".equals(st) ? Instant.now() : null);
		}
		if (body != null && body.commentaire() != null) {
			ta.setCommentaire(body.commentaire());
		}
		return taches.save(ta);
	}

	// ── Photos (preuves terrain) ─────────────────────────────────────────────────

	/** Upload d'une photo (multipart) : type = AVANT|PENDANT|APRES|ANOMALIE|SIGNATURE + géoloc. */
	@PostMapping(value = "/{id}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@Transactional
	public PhotoResponse ajouterPhoto(@PathVariable("id") Long id,
			@RequestParam("file") MultipartFile file,
			@RequestParam("type") String type,
			@RequestParam(value = "commentaire", required = false) String commentaire,
			@RequestParam(value = "lat", required = false) Double lat,
			@RequestParam(value = "lon", required = false) Double lon,
			Authentication auth) {
		ticketInScope(id, auth);
		if (file == null || file.isEmpty()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fichier requis");
		}
		byte[] data;
		try {
			data = file.getBytes();
		} catch (IOException e) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fichier illisible");
		}
		InterventionPhotoEntity p = new InterventionPhotoEntity(
				id, type == null ? "AUTRE" : type.trim().toUpperCase(),
				file.getContentType(), data, blank(commentaire) ? null : commentaire, lat, lon);
		// Placeholder non-null : la colonne URL historique est NOT NULL (ddl-auto ne la relâche pas) ;
		// l'URL réelle a besoin de l'id généré, donc on la pose au 2e save.
		p.setUrl("");
		p = photos.save(p);
		p.setUrl("/api/tickets/" + id + "/photos/" + p.getId() + "/contenu");
		return toPhoto(photos.save(p));
	}

	/** Métadonnées des photos d'une intervention (sans les octets). */
	@GetMapping("/{id}/photos")
	public List<PhotoResponse> photosDe(@PathVariable("id") Long id, Authentication auth) {
		ticketInScope(id, auth);
		return photos.findByTicketIdOrderByTakenAtAsc(id).stream().map(this::toPhoto).toList();
	}

	/** Octets d'une photo (pour <img src>). */
	@GetMapping("/{id}/photos/{photoId}/contenu")
	public ResponseEntity<byte[]> contenuPhoto(@PathVariable("id") Long id,
			@PathVariable("photoId") Long photoId, Authentication auth) {
		ticketInScope(id, auth);
		InterventionPhotoEntity p = photos.findById(photoId).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo introuvable"));
		if (!p.getTicketId().equals(id)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Photo d'une autre intervention");
		}
		MediaType ct = p.getContentType() != null
				? MediaType.parseMediaType(p.getContentType()) : MediaType.APPLICATION_OCTET_STREAM;
		return ResponseEntity.ok().contentType(ct)
				.header(HttpHeaders.CACHE_CONTROL, "max-age=3600").body(p.getData());
	}

	private PhotoResponse toPhoto(InterventionPhotoEntity p) {
		return new PhotoResponse(p.getId(), p.getTicketId(), p.getType(), p.getUrl(), p.getContentType(),
				p.getCommentaire(), p.getLatitude(), p.getLongitude(),
				p.getTakenAt() != null ? p.getTakenAt().toString() : null);
	}

	// ── Helpers ordre de travail ────────────────────────────────────────────────

	/** Notifie le(s) technicien(s) assigné(s) — assignee + affectations ouvertes, pattern alertes. */
	/** Stampe la décision (ACCEPTE/REFUSE) sur l'affectation OUVERTE du caller, si elle existe. */
	private void marquerDecision(Long ticketId, Authentication auth, String decision) {
		if (auth == null) {
			return;
		}
		affectations.findByTicketIdAndClosedAtIsNull(ticketId).stream()
				.filter(a -> a.getPersonneUsername().equalsIgnoreCase(auth.getName()))
				.findFirst()
				.ifPresent(a -> {
					a.setStatut(decision);
					affectations.save(a);
				});
	}

	private void notifierAssignes(TicketEntity t, String type, String titre, String corps) {
		Instant now = Instant.now();
		Set<String> cibles = affectations.findByTicketIdAndClosedAtIsNull(t.getId()).stream()
				.map(AffectationEntity::getPersonneUsername).collect(Collectors.toSet());
		if (t.getAssignee() != null && !t.getAssignee().isBlank()) {
			cibles.add(t.getAssignee());
		}
		for (String username : cibles) {
			NotificationEntity n = notifications.save(new NotificationEntity(
					username, type, titre, corps, null, t.getCommune(), now));
			stream.push(username, NotificationStream.payload(n.getId(), titre, null));
		}
	}

	private static boolean blank(String s) {
		return s == null || s.isBlank();
	}

	private static Instant parseInstant(String iso) {
		if (iso == null || iso.isBlank()) {
			return null;
		}
		try {
			return Instant.parse(iso);
		} catch (Exception e) {
			return null;
		}
	}

	// ── Helpers affectation ──────────────────────────────────────────────────────

	/** Charge le ticket et vérifie qu'il est dans le périmètre du token (commune → département). */
	private TicketEntity ticketInScope(Long id, Authentication auth) {
		TicketEntity ticket = tickets.findById(id).orElseThrow(
				() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Intervention introuvable"));
		TerritorialScope.Scope s = scope.resolve(auth);
		switch (s.niveau()) {
			case NATIONAL:
				return ticket;
			case DEPARTEMENT:
				if (ticket.getCommune() != null && communesDuDept(s.departement()).contains(ticket.getCommune().toLowerCase())) {
					return ticket;
				}
				throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Intervention hors de votre périmètre");
			case COMMUNE:
				if (ticket.getCommune() != null && ticket.getCommune().equalsIgnoreCase(s.commune())) {
					return ticket;
				}
				throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Intervention hors de votre périmètre");
			case AUCUN:
			default:
				throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Hors périmètre");
		}
	}

	private Set<String> communesDuDept(String dept) {
		return communes.findByDepartementIdIgnoreCaseOrderByNomAsc(dept).stream()
				.map(CommuneEntity::getNom).map(String::toLowerCase).collect(Collectors.toSet());
	}

	private AffectationResponse toResponse(AffectationEntity a) {
		return new AffectationResponse(a.getId(), a.getTicketId(), a.getPersonneUsername(),
				a.getPersonneNom(), a.getCommune(), a.estOuverte(), a.getRole(), a.getStatut(),
				a.getCreatedAt() != null ? a.getCreatedAt().toString() : null,
				a.getClosedAt() != null ? a.getClosedAt().toString() : null);
	}

	public record AffecterRequest(String personneUsername, String role) {}

	public record AffectationResponse(Long id, Long ticketId, String personneUsername, String personneNom,
			String commune, boolean ouverte, String role, String statut, String createdAt, String closedAt) {}

	public record CreateInterventionRequest(String type, String priorite, String titre, String commune,
			String ouvrageId, String capteurId, String datePrevue, String heurePrevue, Integer dureeMinutes,
			String consignes, String resultatAttendu, String materiel, String risques, String assignee,
			List<TacheInput> taches) {}

	public record TacheInput(String libelle, Boolean obligatoire) {}

	public record MotifRequest(String motif) {}

	public record CommentaireRequest(String commentaire) {}

	public record TacheUpdate(String statut, String commentaire) {}

	public record PhotoResponse(Long id, Long ticketId, String type, String url, String contentType,
			String commentaire, Double latitude, Double longitude, String takenAt) {}
}
