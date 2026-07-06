package com.example.api_metier.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Pièce visuelle d'une intervention (= ticket). Preuve terrain rattachée par le technicien :
 * avant / pendant / après / anomalie / signature, avec géoloc + horodatage.
 *
 * <p>Le binaire est stocké en base ({@code data} LOB) ; {@code url} est le chemin de service
 * (GET .../contenu) renseigné après le premier save (besoin de l'id généré). Stockage en base
 * (et non sur disque) → survit dans le volume H2, pas de montage à configurer pour la démo.
 */
@Entity
@Table(name = "ticket_photo")
public class InterventionPhotoEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private Long ticketId;

	/** AVANT | PENDANT | APRES | ANOMALIE | SIGNATURE. */
	@Column(nullable = false, length = 20)
	private String type;

	/** Chemin de service du binaire (rempli après save). */
	@Column(length = 500)
	private String url;

	@Column(length = 120)
	private String contentType;

	@Lob
	@Column(name = "data")
	private byte[] data;

	@Column(length = 400)
	private String commentaire;

	@Column
	private Double latitude;

	@Column
	private Double longitude;

	@Column(nullable = false)
	private Instant takenAt = Instant.now();

	protected InterventionPhotoEntity() {}

	public InterventionPhotoEntity(Long ticketId, String type, String contentType, byte[] data,
			String commentaire, Double latitude, Double longitude) {
		this.ticketId = ticketId;
		this.type = type;
		this.contentType = contentType;
		this.data = data;
		this.commentaire = commentaire;
		this.latitude = latitude;
		this.longitude = longitude;
	}

	public Long getId()            { return id; }
	public Long getTicketId()      { return ticketId; }
	public String getType()        { return type; }
	public String getUrl()         { return url; }
	public void setUrl(String v)   { this.url = v; }
	public String getContentType() { return contentType; }
	public byte[] getData()        { return data; }
	public String getCommentaire() { return commentaire; }
	public Double getLatitude()    { return latitude; }
	public Double getLongitude()   { return longitude; }
	public Instant getTakenAt()    { return takenAt; }
}
