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
 * Zone AEP, scopée au département. L'activation est l'écriture la plus sensible d'un
 * superviseur : le {@code departementId} n'est jamais saisi librement — il dérive du
 * périmètre (commune → département), et le serveur le revérifie contre le token au POST.
 *
 * <p>{@code geom} : géométrie stockée en texte (WKT/GeoJSON) — suffisant pour H2. En
 * production PostGIS, ce serait une colonne {@code geometry(Polygon,4326)} et le
 * garde-fou deviendrait {@code ST_Intersects(geom, departement.geom)}. Ici, faute de
 * géométrie exploitable, le garde-fou est applicatif : {@code departementId == token.dept}.
 */
@Entity
@Table(name = "zone")
public class ZoneEntity {

	@Id
	@Column(nullable = false, length = 50)
	private String id;

	@Column(length = 40)
	private String code;

	@Column(nullable = false, length = 160)
	private String nom;

	@Column(length = 80)
	private String commune;

	@Column(nullable = false, length = 50)
	private String departementId;

	@Column(length = 4000)
	private String geom; // WKT/GeoJSON (texte)

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private ZoneStatus statut = ZoneStatus.A_DEPLOYER;

	@Column
	private Integer populationCible;

	@Column(length = 80)
	private String activeePar;

	@Column
	private Instant dateActivation;

	@Column(nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	protected ZoneEntity() {}

	public ZoneEntity(String id, String code, String nom, String commune, String departementId,
			String geom, ZoneStatus statut, Integer populationCible, String activeePar, Instant dateActivation) {
		this.id              = (id == null || id.isBlank()) ? UUID.randomUUID().toString() : id;
		this.code            = code;
		this.nom             = nom;
		this.commune         = commune;
		this.departementId   = departementId;
		this.geom            = geom;
		this.statut          = statut == null ? ZoneStatus.A_DEPLOYER : statut;
		this.populationCible = populationCible;
		this.activeePar      = activeePar;
		this.dateActivation  = dateActivation;
	}

	public String getId()             { return id; }
	public String getCode()           { return code; }
	public String getNom()            { return nom; }
	public String getCommune()        { return commune; }
	public String getDepartementId()  { return departementId; }
	public String getGeom()           { return geom; }
	public ZoneStatus getStatut()     { return statut; }
	public Integer getPopulationCible() { return populationCible; }
	public String getActiveePar()     { return activeePar; }
	public Instant getDateActivation() { return dateActivation; }
	public Instant getCreatedAt()     { return createdAt; }

	public void setStatut(ZoneStatus statut)          { this.statut = statut; }
	public void setActiveePar(String activeePar)      { this.activeePar = activeePar; }
	public void setDateActivation(Instant d)          { this.dateActivation = d; }
}
