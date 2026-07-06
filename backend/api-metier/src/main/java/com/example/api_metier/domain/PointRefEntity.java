package com.example.api_metier.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "points_ref")
public class PointRefEntity {

	@Id
	@Column(nullable = false, length = 80)
	private String id;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false)
	private String type;

	@Column(length = 120)
	private String territory;

	/** Commune du point (périmètre fin, dénormalisé). Recopiée sur l'alerte/le ticket à la création. */
	@Column(length = 80)
	private String commune;

	@Column
	private Double lon;

	@Column
	private Double lat;

	@Column
	private String description;

	@Column(nullable = false)
	private boolean active = true;

	protected PointRefEntity() {
	}

	public PointRefEntity(
			String id,
			String name,
			String type,
			String territory,
			Double lon,
			Double lat,
			String description,
			boolean active) {
		this.id = id;
		this.name = name;
		this.type = type;
		this.territory = territory;
		this.lon = lon;
		this.lat = lat;
		this.description = description;
		this.active = active;
	}

	public String getId() {
		return id;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}

	public String getTerritory() {
		return territory;
	}

	public void setTerritory(String territory) {
		this.territory = territory;
	}

	public String getCommune() {
		return commune;
	}

	public void setCommune(String commune) {
		this.commune = commune;
	}

	public Double getLon() {
		return lon;
	}

	public void setLon(Double lon) {
		this.lon = lon;
	}

	public Double getLat() {
		return lat;
	}

	public void setLat(Double lat) {
		this.lat = lat;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public boolean isActive() {
		return active;
	}

	public void setActive(boolean active) {
		this.active = active;
	}
}
