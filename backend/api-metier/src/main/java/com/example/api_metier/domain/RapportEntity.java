package com.example.api_metier.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Rapport d'activité, scopé à une URD (département).
 *
 * <p>Le périmètre est porté par {@code departementId} : un superviseur ne voit que les
 * rapports de son département, et l'inbox « à valider » = les rapports en état TRANSMIS.
 * Les rapports {@code national} (Exécutif, Audit) vivent au niveau DINEPA — departementId
 * null — et sont exclus de toute vue URD.
 */
@Entity
@Table(name = "rapport")
public class RapportEntity {

	@Id
	@Column(nullable = false, length = 50)
	private String id;

	@Column(nullable = false, length = 200)
	private String titre;

	@Column(nullable = false, length = 40)
	private String type; // mensuel, technique, executif, audit…

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private RapportStatus status;

	@Column(length = 50)
	private String departementId;

	/** true = rapport national (Exécutif/Audit) : hors périmètre URD, jamais dans une vue superviseur. */
	@Column(nullable = false)
	private boolean national = false;

	@Column(length = 80)
	private String commune;

	@Column(length = 120)
	private String auteur;

	@Column(length = 80)
	private String auteurUsername;

	@Column
	private Integer pages;

	@Column
	private Instant transmisLe;

	/** Renseigné lors d'un renvoi : le motif pour l'auteur (jamais un renvoi muet). */
	@Column(length = 400)
	private String motifRenvoi;

	/** Lien dur vers l'intervention (ticket) pour un rapport d'intervention — chaîne tracée par ID. */
	@Column
	private Long interventionId;

	// ── Contenu terrain (circuit TEPAC) ──────────────────────────────────────
	/** Choix guidés du technicien (cases cochées, GPS, ouvrage concerné…), sérialisés en JSON. */
	@Column(length = 4000)
	private String contenuJson;

	/** Texte professionnel généré automatiquement à partir de {@link #contenuJson}. */
	@Column(length = 4000)
	private String resumeAuto;

	// ── Décision du superviseur (validation) ─────────────────────────────────
	@Column(length = 80)
	private String validePar;

	@Column
	private Instant valideLe;

	// ── Signature relais → admin national ────────────────────────────────────
	/** Nom affiché du superviseur signataire (pour le pied de page du rapport officiel). */
	@Column(length = 120)
	private String signataire;

	@Column(length = 80)
	private String signataireUsername;

	@Column
	private Instant signeLe;

	@Column(nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	protected RapportEntity() {}

	public RapportEntity(String id, String titre, String type, RapportStatus status,
			String departementId, boolean national, String commune,
			String auteur, String auteurUsername, Integer pages, Instant transmisLe) {
		this.id             = (id == null || id.isBlank()) ? UUID.randomUUID().toString() : id;
		this.titre          = titre;
		this.type           = type;
		this.status         = status;
		this.departementId  = departementId;
		this.national       = national;
		this.commune        = commune;
		this.auteur         = auteur;
		this.auteurUsername = auteurUsername;
		this.pages          = pages;
		this.transmisLe     = transmisLe;
	}

	public String getId()             { return id; }
	public String getTitre()          { return titre; }
	public String getType()           { return type; }
	public RapportStatus getStatus()  { return status; }
	public String getDepartementId()  { return departementId; }
	public boolean isNational()       { return national; }
	public String getCommune()        { return commune; }
	public String getAuteur()         { return auteur; }
	public String getAuteurUsername() { return auteurUsername; }
	public Integer getPages()         { return pages; }
	public Instant getTransmisLe()    { return transmisLe; }
	public String getMotifRenvoi()    { return motifRenvoi; }
	public Long getInterventionId()   { return interventionId; }
	public String getContenuJson()    { return contenuJson; }
	public String getResumeAuto()     { return resumeAuto; }
	public String getValidePar()      { return validePar; }
	public Instant getValideLe()      { return valideLe; }
	public String getSignataire()     { return signataire; }
	public String getSignataireUsername() { return signataireUsername; }
	public Instant getSigneLe()       { return signeLe; }
	public Instant getCreatedAt()     { return createdAt; }

	public void setStatus(RapportStatus status)   { this.status = status; }
	public void setMotifRenvoi(String motifRenvoi) { this.motifRenvoi = motifRenvoi; }
	public void setInterventionId(Long interventionId) { this.interventionId = interventionId; }
	public void setTransmisLe(Instant transmisLe)  { this.transmisLe = transmisLe; }
	public void setContenuJson(String contenuJson) { this.contenuJson = contenuJson; }
	public void setResumeAuto(String resumeAuto)   { this.resumeAuto = resumeAuto; }

	/** Décision de validation du superviseur (TRANSMIS → VALIDE). */
	public void valider(String username, Instant when) {
		this.status     = RapportStatus.VALIDE;
		this.validePar  = username;
		this.valideLe   = when;
		this.motifRenvoi = null;
	}

	/** Signature relais : le superviseur signe et transmet à l'admin (VALIDE → TRANSMIS_ADMIN). */
	public void signerEtTransmettre(String username, String nomAffiche, Instant when) {
		this.status             = RapportStatus.TRANSMIS_ADMIN;
		this.signataireUsername = username;
		this.signataire         = nomAffiche;
		this.signeLe            = when;
	}
}
