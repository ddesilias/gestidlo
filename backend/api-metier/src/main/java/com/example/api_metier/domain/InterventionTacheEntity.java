package com.example.api_metier.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Une tâche de la checklist d'une intervention (= ticket). Posée par le superviseur à la
 * création (template par type), cochée une-par-une par le technicien sur le terrain.
 * Statut : A_FAIRE | FAIT | NON_APPLICABLE.
 */
@Entity
@Table(name = "ticket_tache")
public class InterventionTacheEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long ticketId;

	@Column(nullable = false, length = 300)
	private String libelle;

	@Column(nullable = false)
	private boolean obligatoire;

	@Column(nullable = false)
	private int ordre;

	@Column(nullable = false, length = 20)
	private String statut = "A_FAIRE";

	@Column(length = 500)
	private String commentaire;

	@Column
	private Instant completedAt;

	protected InterventionTacheEntity() {}

	public InterventionTacheEntity(Long ticketId, String libelle, boolean obligatoire, int ordre) {
		this.ticketId = ticketId;
		this.libelle = libelle;
		this.obligatoire = obligatoire;
		this.ordre = ordre;
		this.statut = "A_FAIRE";
	}

	public Long getId()               { return id; }
	public Long getTicketId()         { return ticketId; }
	public String getLibelle()        { return libelle; }
	public boolean isObligatoire()    { return obligatoire; }
	public int getOrdre()             { return ordre; }
	public String getStatut()         { return statut; }
	public void setStatut(String v)   { this.statut = v; }
	public String getCommentaire()    { return commentaire; }
	public void setCommentaire(String v) { this.commentaire = v; }
	public Instant getCompletedAt()   { return completedAt; }
	public void setCompletedAt(Instant v) { this.completedAt = v; }
}
