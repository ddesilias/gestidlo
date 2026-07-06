package com.example.api_metier.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "tickets")
public class TicketEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private TicketStatus status;

	/** Nature : ALERTE (auto/Camunda) vs ORDRE (ordre de travail superviseur, manuel). */
	@Enumerated(EnumType.STRING)
	@Column(length = 10)
	private TicketKind kind = TicketKind.ALERTE;

	@Column
	private Long alertId;

	@Column(nullable = false)
	private String pointId;

	@Column(nullable = false)
	private String sensorId;

	/** Commune (dénormalisée, héritée de l'alerte) : périmètre fin du TEPAC, filtrable sans jointure. */
	@Column(length = 80)
	private String commune;

	/** Ressource d'origine (lien dur), héritée de l'alerte — trace la chaîne ressource→alerte→intervention. */
	@Column(length = 50)
	private String ressourceId;

	/** Libellé de l'intervention (hérité du message de l'alerte à la création). */
	@Column(length = 200)
	private String titre;

	@Column
	private String assignee;

	@Column
	private String camundaProcessInstanceId;

	// ── Ordre de travail (intervention superviseur → technicien) ────────────────
	// Tous nullables : un ticket né d'alerte n'en porte aucun ; une intervention créée
	// par un superviseur les remplit via l'assistant. La commune/le titre/l'assignee
	// existants restent la base partagée.

	/** Type d'intervention (iot, inspection, maintenance, reparation, urgence, journalier…). */
	@Column(length = 40)
	private String type;

	/** Priorité métier : basse | normale | haute | urgente. */
	@Column(length = 20)
	private String priorite;

	/** Ouvrage concerné (clé station), si l'intervention en cible un. */
	@Column(length = 50)
	private String ouvrageId;

	/** Capteur concerné (code), si l'intervention cible un capteur précis. */
	@Column(length = 50)
	private String capteurId;

	/** Username du superviseur émetteur (auteur de l'ordre de travail). */
	@Column(length = 80)
	private String superviseurId;

	@Column
	private Instant datePrevue;

	@Column(length = 10)
	private String heurePrevue;

	@Column
	private Integer dureeMinutes;

	@Column(length = 1000)
	private String consignes;

	@Column(length = 600)
	private String resultatAttendu;

	@Column(length = 400)
	private String materiel;

	@Column(length = 400)
	private String risques;

	@Column(length = 400)
	private String motifRejet;

	// ── Validation superviseur (fiche d'intervention, bloc K) ───────────────────
	// Overlaie l'état de validation sur le ticket lui-même : qui a validé, quand, et le
	// commentaire (validation OU motif de correction). Le statut fait foi (VALIDEE/CLOSED) ;
	// ces colonnes ne font que tracer l'auteur et la date pour la fiche.

	/** Username du superviseur ayant validé le rapport terrain (null tant qu'en attente). */
	@Column(length = 80)
	private String valideePar;

	@Column
	private Instant valideeAt;

	/** Commentaire du superviseur à la validation, ou motif d'une demande de correction. */
	@Column(length = 600)
	private String commentaireValidation;

	/** Rapport (brouillon) généré à partir de cette intervention, si déjà créé. */
	@Column
	private Long rapportId;

	@Column
	private Instant acceptedAt;

	@Column
	private Instant startedAt;

	@Column
	private Instant completedAt;

	@Column(nullable = false)
	private Instant createdAt;

	@Column(nullable = false)
	private Instant updatedAt;

	protected TicketEntity() {
	}

	public TicketEntity(TicketStatus status, Long alertId, String pointId, String sensorId, String assignee,
			Instant createdAt, Instant updatedAt) {
		this(status, alertId, pointId, sensorId, assignee, createdAt, updatedAt, null);
	}

	public TicketEntity(TicketStatus status, Long alertId, String pointId, String sensorId, String assignee,
			Instant createdAt, Instant updatedAt, String commune) {
		this.status = status;
		this.alertId = alertId;
		this.pointId = pointId;
		this.sensorId = sensorId;
		this.assignee = assignee;
		this.createdAt = createdAt;
		this.updatedAt = updatedAt;
		this.commune = commune;
	}

	public Long getId() {
		return id;
	}

	public TicketStatus getStatus() {
		return status;
	}

	public void setStatus(TicketStatus status) {
		this.status = status;
	}

	public Long getAlertId() {
		return alertId;
	}

	public String getPointId() {
		return pointId;
	}

	public String getSensorId() {
		return sensorId;
	}

	public String getCommune() {
		return commune;
	}

	public void setCommune(String commune) {
		this.commune = commune;
	}

	public String getRessourceId() {
		return ressourceId;
	}

	public void setRessourceId(String ressourceId) {
		this.ressourceId = ressourceId;
	}

	public String getTitre() {
		return titre;
	}

	public void setTitre(String titre) {
		this.titre = titre;
	}

	public String getAssignee() {
		return assignee;
	}

	public void setAssignee(String assignee) {
		this.assignee = assignee;
	}

	public String getCamundaProcessInstanceId() {
		return camundaProcessInstanceId;
	}

	public void setCamundaProcessInstanceId(String camundaProcessInstanceId) {
		this.camundaProcessInstanceId = camundaProcessInstanceId;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public void setUpdatedAt(Instant updatedAt) {
		this.updatedAt = updatedAt;
	}

	// ── Ordre de travail : getters / setters ────────────────────────────────────
	public TicketKind getKind()          { return kind; }
	public void setKind(TicketKind v)    { this.kind = v; }
	public String getType()              { return type; }
	public void setType(String v)        { this.type = v; }
	public String getPriorite()          { return priorite; }
	public void setPriorite(String v)    { this.priorite = v; }
	public String getOuvrageId()         { return ouvrageId; }
	public void setOuvrageId(String v)   { this.ouvrageId = v; }
	public String getCapteurId()         { return capteurId; }
	public void setCapteurId(String v)   { this.capteurId = v; }
	public String getSuperviseurId()     { return superviseurId; }
	public void setSuperviseurId(String v) { this.superviseurId = v; }
	public Instant getDatePrevue()       { return datePrevue; }
	public void setDatePrevue(Instant v) { this.datePrevue = v; }
	public String getHeurePrevue()       { return heurePrevue; }
	public void setHeurePrevue(String v) { this.heurePrevue = v; }
	public Integer getDureeMinutes()     { return dureeMinutes; }
	public void setDureeMinutes(Integer v) { this.dureeMinutes = v; }
	public String getConsignes()         { return consignes; }
	public void setConsignes(String v)   { this.consignes = v; }
	public String getResultatAttendu()   { return resultatAttendu; }
	public void setResultatAttendu(String v) { this.resultatAttendu = v; }
	public String getMateriel()          { return materiel; }
	public void setMateriel(String v)    { this.materiel = v; }
	public String getRisques()           { return risques; }
	public void setRisques(String v)     { this.risques = v; }
	public String getMotifRejet()        { return motifRejet; }
	public void setMotifRejet(String v)  { this.motifRejet = v; }
	public String getValideePar()        { return valideePar; }
	public void setValideePar(String v)  { this.valideePar = v; }
	public Instant getValideeAt()        { return valideeAt; }
	public void setValideeAt(Instant v)  { this.valideeAt = v; }
	public String getCommentaireValidation()       { return commentaireValidation; }
	public void setCommentaireValidation(String v) { this.commentaireValidation = v; }
	public Long getRapportId()           { return rapportId; }
	public void setRapportId(Long v)     { this.rapportId = v; }
	public Instant getAcceptedAt()       { return acceptedAt; }
	public void setAcceptedAt(Instant v) { this.acceptedAt = v; }
	public Instant getStartedAt()        { return startedAt; }
	public void setStartedAt(Instant v)  { this.startedAt = v; }
	public Instant getCompletedAt()      { return completedAt; }
	public void setCompletedAt(Instant v) { this.completedAt = v; }
}

