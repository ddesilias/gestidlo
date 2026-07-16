package com.example.api_metier.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Métadonnées d'un type de mesure — table SÉPARÉE qui COMPLÈTE la codelist
 * {@code reference_code_items} (liste MEASUREMENT_TYPE) sans la modifier.
 *
 * Calquée sur {@link ThresholdConfigEntity} : clé = le code de mesure (même code que
 * la codelist), lien logique par code (pas de FK dure). {@code valueType} est stocké
 * en String libre (« Numérique / Booléen / Texte ») — jamais un enum — pour éviter le
 * piège CHECK-constraint H2 sur ddl-auto=update.
 */
@Entity
@Table(name = "measurement_type_meta")
public class MeasurementTypeMetaEntity {

	@Id
	@Column(nullable = false)
	private String code;

	@Column
	private String unit;

	@Column
	private String category;

	@Column(length = 1000)
	private String description;

	/** « Numérique » / « Booléen » / « Texte ». String libre volontairement (pas d'enum). */
	@Column
	private String valueType;

	@Column
	private Integer decimals;

	@Column
	private Double minValue;

	@Column
	private Double maxValue;

	@Column(nullable = false)
	private boolean usableInAlerts = true;

	@Column(nullable = false)
	private boolean usableInReports = true;

	protected MeasurementTypeMetaEntity() {
	}

	public MeasurementTypeMetaEntity(
			String code, String unit, String category, String description,
			String valueType, Integer decimals, Double minValue, Double maxValue,
			boolean usableInAlerts, boolean usableInReports) {
		this.code = code;
		this.unit = unit;
		this.category = category;
		this.description = description;
		this.valueType = valueType;
		this.decimals = decimals;
		this.minValue = minValue;
		this.maxValue = maxValue;
		this.usableInAlerts = usableInAlerts;
		this.usableInReports = usableInReports;
	}

	public String getCode() {
		return code;
	}

	public String getUnit() {
		return unit;
	}

	public void setUnit(String unit) {
		this.unit = unit;
	}

	public String getCategory() {
		return category;
	}

	public void setCategory(String category) {
		this.category = category;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public String getValueType() {
		return valueType;
	}

	public void setValueType(String valueType) {
		this.valueType = valueType;
	}

	public Integer getDecimals() {
		return decimals;
	}

	public void setDecimals(Integer decimals) {
		this.decimals = decimals;
	}

	public Double getMinValue() {
		return minValue;
	}

	public void setMinValue(Double minValue) {
		this.minValue = minValue;
	}

	public Double getMaxValue() {
		return maxValue;
	}

	public void setMaxValue(Double maxValue) {
		this.maxValue = maxValue;
	}

	public boolean isUsableInAlerts() {
		return usableInAlerts;
	}

	public void setUsableInAlerts(boolean usableInAlerts) {
		this.usableInAlerts = usableInAlerts;
	}

	public boolean isUsableInReports() {
		return usableInReports;
	}

	public void setUsableInReports(boolean usableInReports) {
		this.usableInReports = usableInReports;
	}
}
