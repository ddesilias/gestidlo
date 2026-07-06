package com.example.api_metier.service;

import com.example.api_metier.domain.AlertEntity;
import com.example.api_metier.domain.AlertSeverity;
import com.example.api_metier.domain.AlertStatus;
import com.example.api_metier.domain.MeasurementEntity;
import com.example.api_metier.domain.PointRefEntity;
import com.example.api_metier.domain.ReferenceCodeItemEntity;
import com.example.api_metier.domain.ReferenceCodeItemId;
import com.example.api_metier.domain.ThresholdConfigEntity;
import com.example.api_metier.repo.AlertRepository;
import com.example.api_metier.repo.CapteurRepository;
import com.example.api_metier.repo.MeasurementRepository;
import com.example.api_metier.repo.PointRefRepository;
import com.example.api_metier.repo.ReferenceCodeItemRepository;
import com.example.api_metier.repo.ThresholdConfigRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MeasurementService {

	private final MeasurementRepository measurements;
	private final AlertRepository alerts;
	private final PointRefRepository points;
	private final CapteurRepository capteurs;
	private final ThresholdConfigRepository thresholdConfigs;
	private final ReferenceCodeItemRepository codeItems;
	private final double defaultMinPressureWarn;
	private final double defaultMinPressureCrit;
	private final double defaultMinLevelCrit;

	public MeasurementService(
			MeasurementRepository measurements,
			AlertRepository alerts,
			PointRefRepository points,
			CapteurRepository capteurs,
			ThresholdConfigRepository thresholdConfigs,
			ReferenceCodeItemRepository codeItems,
			@Value("${gestidlo.threshold.pressure.minWarn}") double minPressureWarn,
			@Value("${gestidlo.threshold.pressure.minCrit}") double minPressureCrit,
			@Value("${gestidlo.threshold.level.minCrit}") double minLevelCrit) {
		this.measurements = measurements;
		this.alerts = alerts;
		this.points = points;
		this.capteurs = capteurs;
		this.thresholdConfigs = thresholdConfigs;
		this.codeItems = codeItems;
		this.defaultMinPressureWarn = minPressureWarn;
		this.defaultMinPressureCrit = minPressureCrit;
		this.defaultMinLevelCrit = minLevelCrit;
	}

	@Transactional
	public IngestResult ingest(IngestRequest request) {
		String type = normalizeType(request.type());
		validateMeasurementType(type);

		Instant ts = request.timestamp() != null ? request.timestamp() : Instant.now();
		MeasurementEntity measurement = new MeasurementEntity(
				request.pointId(),
				request.sensorId(),
				type,
				request.value(),
				request.unit(),
				ts);
		measurement = measurements.save(measurement);

		List<Long> createdOrUpdatedAlerts = new ArrayList<>();
		AlertDecision decision = decideAlert(type, request.value(), request.unit());
		if (decision != null) {
			AlertEntity alert = alerts.findFirstByPointIdAndTypeAndStatusOrderByOpenedAtDesc(
					request.pointId(), type, AlertStatus.ACTIVE)
					.orElse(null);
			Instant now = Instant.now();
			if (alert == null) {
				// Dénormalisation : commune recopiée du point sur l'alerte à la création,
				// pour un scope TEPAC sans jointure (un TEPAC ne voit que sa commune).
				String commune = points.findById(request.pointId())
						.map(PointRefEntity::getCommune).orElse(null);
				alert = new AlertEntity(
						request.pointId(),
						request.sensorId(),
						type,
						decision.severity(),
						AlertStatus.ACTIVE,
						decision.message(),
						now,
						now,
						commune);
			} else {
				alert.setSeverity(decision.severity());
				alert.setMessage(decision.message());
				alert.setUpdatedAt(now);
			}
			alert = alerts.save(alert);
			createdOrUpdatedAlerts.add(alert.getId());
		}

		// Temps réel : mise à jour live du capteur du registre, corrélé par sensorCode (à défaut sensorId).
		// Alimente l'état dérivé (en-ligne/attention/critique) + batterie/signal de la page Capteurs IoT.
		String capteurCode = (request.sensorCode() != null && !request.sensorCode().isBlank())
				? request.sensorCode() : request.sensorId();
		if (capteurCode != null && !capteurCode.isBlank()) {
			capteurs.findByCodeIgnoreCase(capteurCode.trim()).ifPresent(c -> {
				c.onMeasure(request.value(), request.unit(), request.battery(), request.signal(), ts);
				capteurs.save(c);
			});
		}

		return new IngestResult(measurement.getId(), createdOrUpdatedAlerts);
	}

	@Transactional(readOnly = true)
	public List<PointRealtimeView> realtimePoints(List<String> pointIds) {
		List<String> types = activeMeasurementTypeCodes();
		List<PointRealtimeView> result = new ArrayList<>();
		for (String pointId : pointIds) {
			Map<String, MeasurementEntity> last = new LinkedHashMap<>();
			for (String type : types) {
				measurements.findTop1ByPointIdAndTypeOrderByTimestampDesc(pointId, type)
						.ifPresent(m -> last.put(type, m));
			}

			result.add(PointRealtimeView.from(pointId, last));
		}
		return result;
	}

	@Transactional(readOnly = true)
	public List<MeasurementEntity> history(String pointId, String type, Instant from, Instant to) {
		return measurements.findByPointIdAndTypeAndTimestampBetweenOrderByTimestampAsc(pointId, type, from, to);
	}

	private AlertDecision decideAlert(String type, double value, String unit) {
		if ("PRESSURE".equals(type)) {
			return decidePressureAlert(type, value, unit);
		}
		if ("LEVEL".equals(type)) {
			return decideLevelAlert(type, value, unit);
		}
		return decideGenericMinAlert(type, value, unit);
	}

	private AlertDecision decidePressureAlert(String type, double value, String unit) {
		ThresholdConfigEntity cfg = thresholdConfigs.findById(type).orElse(null);
		double minCrit = cfg != null && cfg.getMinCrit() != null ? cfg.getMinCrit() : defaultMinPressureCrit;
		double minWarn = cfg != null && cfg.getMinWarn() != null ? cfg.getMinWarn() : defaultMinPressureWarn;

		if (value < minCrit) {
			return new AlertDecision(AlertSeverity.CRIT,
					"Sous-pression critique: " + value + " " + unit + " (min " + minCrit + ")");
		}
		if (value < minWarn) {
			return new AlertDecision(AlertSeverity.WARN,
					"Sous-pression: " + value + " " + unit + " (min " + minWarn + ")");
		}
		return null;
	}

	private AlertDecision decideLevelAlert(String type, double value, String unit) {
		ThresholdConfigEntity cfg = thresholdConfigs.findById(type).orElse(null);
		double minCrit = cfg != null && cfg.getMinCrit() != null ? cfg.getMinCrit() : defaultMinLevelCrit;
		if (value < minCrit) {
			return new AlertDecision(AlertSeverity.CRIT,
					"Niveau critique: " + value + " " + unit + " (min " + minCrit + ")");
		}
		return null;
	}

	private AlertDecision decideGenericMinAlert(String type, double value, String unit) {
		ThresholdConfigEntity cfg = thresholdConfigs.findById(type).orElse(null);
		if (cfg == null) {
			return null;
		}
		if (cfg.getMinCrit() != null && value < cfg.getMinCrit()) {
			return new AlertDecision(
					AlertSeverity.CRIT,
					"Seuil critique (" + type + "): " + value + " " + unit + " (min " + cfg.getMinCrit() + ")");
		}
		if (cfg.getMinWarn() != null && value < cfg.getMinWarn()) {
			return new AlertDecision(
					AlertSeverity.WARN,
					"Seuil (" + type + "): " + value + " " + unit + " (min " + cfg.getMinWarn() + ")");
		}
		return null;
	}

	private record AlertDecision(AlertSeverity severity, String message) {
	}

	public record IngestRequest(
			String pointId,
			String sensorId,
			String sensorCode,
			String type,
			double value,
			String unit,
			Integer battery,
			Integer signal,
			Instant timestamp) {

		/** Surcharge rétro-compatible (ancien format à 6 champs, sans sensorCode/batterie/signal). */
		public IngestRequest(String pointId, String sensorId, String type, double value, String unit, Instant timestamp) {
			this(pointId, sensorId, null, type, value, unit, null, null, timestamp);
		}
	}

	public record IngestResult(Long measurementId, List<Long> alertIds) {
	}

	public record PointRealtimeView(String pointId, Map<String, Object> lastMeasurements) {
		public static PointRealtimeView from(String pointId, Map<String, MeasurementEntity> last) {
			Map<String, Object> m = new LinkedHashMap<>();
			for (Map.Entry<String, MeasurementEntity> entry : last.entrySet()) {
				MeasurementEntity me = entry.getValue();
				Map<String, Object> dto = new LinkedHashMap<>();
				dto.put("value", me.getValue());
				dto.put("unit", me.getUnit());
				dto.put("timestamp", me.getTimestamp());
				m.put(entry.getKey(), dto);
			}
			return new PointRealtimeView(pointId, m);
		}
	}

	private String normalizeType(String type) {
		if (type == null) {
			return null;
		}
		return type.trim().toUpperCase();
	}

	private void validateMeasurementType(String type) {
		if (type == null || type.isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "type is required");
		}
		ReferenceCodeItemId id = new ReferenceCodeItemId("MEASUREMENT_TYPE", type);
		ReferenceCodeItemEntity item = codeItems.findById(id).orElse(null);
		if (item == null || !item.isActive()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown measurement type: " + type);
		}
	}

	private List<String> activeMeasurementTypeCodes() {
		return codeItems.findActiveByListName("MEASUREMENT_TYPE")
				.stream()
				.map(ReferenceCodeItemEntity::getCode)
				.toList();
	}
}
