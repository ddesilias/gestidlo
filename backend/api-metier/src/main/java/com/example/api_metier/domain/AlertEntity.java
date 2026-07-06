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
@Table(name = "alerts")
public class AlertEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false)
	private String pointId;

	@Column(nullable = false)
	private String sensorId;

	/** Commune (dénormalisée du point) : périmètre fin du TEPAC, filtrable sans jointure. */
	@Column(length = 80)
	private String commune;

	/** Ressource d'origine (lien dur) quand l'alerte naît d'une ressource menacée/polluée. */
	@Column(length = 50)
	private String ressourceId;

	@Column(nullable = false)
	private String type;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private AlertSeverity severity;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private AlertStatus status;

	@Column(nullable = false)
	private String message;

	@Column(nullable = false)
	private Instant openedAt;

	@Column(nullable = false)
	private Instant updatedAt;

	protected AlertEntity() {
	}

	public AlertEntity(String pointId, String sensorId, String type, AlertSeverity severity,
			AlertStatus status, String message, Instant openedAt, Instant updatedAt) {
		this(pointId, sensorId, type, severity, status, message, openedAt, updatedAt, null);
	}

	public AlertEntity(String pointId, String sensorId, String type, AlertSeverity severity,
			AlertStatus status, String message, Instant openedAt, Instant updatedAt, String commune) {
		this.pointId = pointId;
		this.sensorId = sensorId;
		this.type = type;
		this.severity = severity;
		this.status = status;
		this.message = message;
		this.openedAt = openedAt;
		this.updatedAt = updatedAt;
		this.commune = commune;
	}

	public Long getId() {
		return id;
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

	public String getType() {
		return type;
	}

	public AlertSeverity getSeverity() {
		return severity;
	}

	public void setSeverity(AlertSeverity severity) {
		this.severity = severity;
	}

	public AlertStatus getStatus() {
		return status;
	}

	public void setStatus(AlertStatus status) {
		this.status = status;
	}

	public String getMessage() {
		return message;
	}

	public void setMessage(String message) {
		this.message = message;
	}

	public Instant getOpenedAt() {
		return openedAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public void setUpdatedAt(Instant updatedAt) {
		this.updatedAt = updatedAt;
	}
}
