package com.example.api_metier.web;

import com.example.api_metier.domain.MeasurementTypeMetaEntity;
import com.example.api_metier.domain.PointRefEntity;
import com.example.api_metier.domain.ReferenceCodeItemEntity;
import com.example.api_metier.domain.ReferenceCodeItemId;
import com.example.api_metier.domain.ThresholdConfigEntity;
import com.example.api_metier.repo.AlertRepository;
import com.example.api_metier.repo.MeasurementRepository;
import com.example.api_metier.repo.MeasurementTypeMetaRepository;
import com.example.api_metier.repo.PointRefRepository;
import com.example.api_metier.repo.ReferenceCodeItemRepository;
import com.example.api_metier.repo.ThresholdConfigRepository;
import com.example.api_metier.repo.TicketRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reference")
public class ReferenceController {

	private final PointRefRepository points;
	private final ThresholdConfigRepository thresholds;
	private final ReferenceCodeItemRepository codeItems;
	private final MeasurementRepository measurements;
	private final AlertRepository alerts;
	private final TicketRepository tickets;
	private final MeasurementTypeMetaRepository measurementMeta;

	public ReferenceController(
			PointRefRepository points,
			ThresholdConfigRepository thresholds,
			ReferenceCodeItemRepository codeItems,
			MeasurementRepository measurements,
			AlertRepository alerts,
			TicketRepository tickets,
			MeasurementTypeMetaRepository measurementMeta) {
		this.points = points;
		this.thresholds = thresholds;
		this.codeItems = codeItems;
		this.measurements = measurements;
		this.alerts = alerts;
		this.tickets = tickets;
		this.measurementMeta = measurementMeta;
	}

	@GetMapping("/points")
	public List<PointDto> points() {
		return points.findAll().stream().map(PointDto::from).toList();
	}

	@PutMapping("/points/{id}")
	public PointDto upsertPoint(@PathVariable("id") String id, @RequestBody PointUpsertRequest body) {
		PointRefEntity entity = points.findById(id).orElseGet(() -> new PointRefEntity(
				id,
				id,
				"KIOSK",
				null,
				null,
				null,
				null,
				true));

		entity.setName(body.name() == null || body.name().isBlank() ? id : body.name());
		String type = body.type() == null || body.type().isBlank() ? entity.getType() : body.type().trim().toUpperCase();
		validatePointType(type);
		entity.setType(type);
		if (body.territory() != null) {
			String territory = body.territory().isBlank() ? null : body.territory().trim();
			entity.setTerritory(territory);
		}
		if (body.lon() != null) {
			entity.setLon(body.lon());
		}
		if (body.lat() != null) {
			entity.setLat(body.lat());
		}

		// Common mistake: swap lon/lat.
		if (entity.getLon() != null && entity.getLat() != null) {
			double lon = entity.getLon();
			double lat = entity.getLat();

			double minLon = -75.5;
			double maxLon = -71.0;
			double minLat = 17.5;
			double maxLat = 20.5;

			boolean inHaiti = lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
			boolean swappedInHaiti = lat >= minLon && lat <= maxLon && lon >= minLat && lon <= maxLat;

			if (!inHaiti && swappedInHaiti) {
				entity.setLon(lat);
				entity.setLat(lon);
				lon = entity.getLon();
				lat = entity.getLat();
				inHaiti = lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
			}

			if (!inHaiti && lon > 0) {
				double flipped = -lon;
				if (flipped >= minLon && flipped <= maxLon && lat >= minLat && lat <= maxLat) {
					entity.setLon(flipped);
				}
			}
			if (!inHaiti && lat < 0) {
				double flipped = -lat;
				if (lon >= minLon && lon <= maxLon && flipped >= minLat && flipped <= maxLat) {
					entity.setLat(flipped);
				}
			}
		}
		entity.setDescription(body.description());
		entity.setActive(body.active() == null ? entity.isActive() : body.active());

		return PointDto.from(points.save(entity));
	}

	@DeleteMapping("/points/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deletePoint(@PathVariable("id") String id) {
		long measurementsCount = measurements.countByPointId(id);
		long alertsCount = alerts.countByPointId(id);
		long ticketsCount = tickets.countByPointId(id);
		if (measurementsCount > 0 || alertsCount > 0 || ticketsCount > 0) {
			throw new org.springframework.web.server.ResponseStatusException(
					HttpStatus.CONFLICT,
					"Cannot delete point in use: " + id);
		}
		points.deleteById(id);
	}

	@GetMapping("/thresholds")
	public List<ThresholdDto> thresholds() {
		return thresholds.findAll().stream().map(ThresholdDto::from).toList();
	}

	@PutMapping("/thresholds/{type}")
	public ThresholdDto upsertThreshold(
			@PathVariable("type") String type,
			@RequestBody ThresholdUpsertRequest body) {
		ThresholdConfigEntity entity = thresholds.findById(type)
				.orElseGet(() -> new ThresholdConfigEntity(type, null, null));
		entity.setMinWarn(body.minWarn());
		entity.setMinCrit(body.minCrit());
		return ThresholdDto.from(thresholds.save(entity));
	}

	// ── Métadonnées des types de mesure (complète la codelist MEASUREMENT_TYPE, ne la remplace pas) ──
	@GetMapping("/measurement-meta")
	public List<MeasurementMetaDto> measurementMeta() {
		return measurementMeta.findAll().stream().map(MeasurementMetaDto::from).toList();
	}

	@PutMapping("/measurement-meta/{code}")
	public MeasurementMetaDto upsertMeasurementMeta(
			@PathVariable("code") String code,
			@RequestBody MeasurementMetaUpsertRequest body) {
		String key = code == null ? "" : code.trim().toUpperCase();
		if (key.isBlank()) {
			throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST, "code is required");
		}
		MeasurementTypeMetaEntity entity = measurementMeta.findById(key)
				.orElseGet(() -> new MeasurementTypeMetaEntity(key, null, null, null, null, null, null, null, true, true));
		entity.setUnit(body.unit());
		entity.setCategory(body.category());
		entity.setDescription(body.description());
		entity.setValueType(body.valueType());
		entity.setDecimals(body.decimals());
		entity.setMinValue(body.minValue());
		entity.setMaxValue(body.maxValue());
		entity.setUsableInAlerts(body.usableInAlerts() == null || body.usableInAlerts());
		entity.setUsableInReports(body.usableInReports() == null || body.usableInReports());
		return MeasurementMetaDto.from(measurementMeta.save(entity));
	}

	@GetMapping("/codelists")
	public List<CodeListDto> codeLists() {
		return codeItems.findDistinctListNames().stream().map(CodeListDto::new).toList();
	}

	@GetMapping("/codelists/{listName}")
	public List<CodeItemDto> codeList(@PathVariable("listName") String listName) {
		return codeItems.findByIdListNameOrderBySortOrderAscIdCodeAsc(listName)
				.stream()
				.map(CodeItemDto::from)
				.toList();
	}

	@PutMapping("/codelists/{listName}/{code}")
	public CodeItemDto upsertCodeItem(
			@PathVariable("listName") String listName,
			@PathVariable("code") String code,
			@RequestBody CodeItemUpsertRequest body) {
		ReferenceCodeItemEntity entity = codeItems.findById(new ReferenceCodeItemId(listName, code))
				.orElseGet(() -> new ReferenceCodeItemEntity(listName, code, null, null, null, null, 0, true));

		entity.setLabelFr(body.labelFr());
		entity.setLabelHt(body.labelHt());
		entity.setLabelEn(body.labelEn());
		entity.setColor(body.color());
		entity.setSortOrder(body.sortOrder());
		entity.setActive(body.active() == null || body.active());

		return CodeItemDto.from(codeItems.save(entity));
	}

	@DeleteMapping("/codelists/{listName}/{code}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteCodeItem(@PathVariable("listName") String listName, @PathVariable("code") String code) {
		ReferenceCodeItemId id = new ReferenceCodeItemId(listName, code);
		if (!codeItems.existsById(id)) {
			return;
		}

		if ("MEASUREMENT_TYPE".equals(listName)) {
			long measurementsCount = measurements.countByType(code);
			long alertsCount = alerts.countByType(code);
			boolean hasThreshold = thresholds.existsById(code);
			if (measurementsCount > 0 || alertsCount > 0 || hasThreshold) {
				throw new org.springframework.web.server.ResponseStatusException(
						HttpStatus.CONFLICT,
						"Cannot delete measurement type in use: " + code);
			}
			// Nettoyage : la ligne de métadonnées suit le code supprimé (pas d'orpheline).
			measurementMeta.findById(code).ifPresent(measurementMeta::delete);
		}

		if ("POINT_TYPE".equals(listName)) {
			long pointsCount = points.countByType(code);
			if (pointsCount > 0) {
				throw new org.springframework.web.server.ResponseStatusException(
						HttpStatus.CONFLICT,
						"Cannot delete point type in use: " + code);
			}
		}

		codeItems.deleteById(id);
	}

	public record PointUpsertRequest(
			String name,
			String type,
			String territory,
			Double lon,
			Double lat,
			String description,
			Boolean active) {
	}

	public record PointDto(
			String id,
			String name,
			String type,
			String territory,
			Double lon,
			Double lat,
			String description,
			boolean active) {
		public static PointDto from(PointRefEntity e) {
			return new PointDto(
				e.getId(),
				e.getName(),
				e.getType(),
				e.getTerritory(),
				e.getLon(),
				e.getLat(),
				e.getDescription(),
				e.isActive());
		}
	}

	public record ThresholdUpsertRequest(Double minWarn, Double minCrit) {
	}

	public record MeasurementMetaUpsertRequest(
			String unit,
			String category,
			String description,
			String valueType,
			Integer decimals,
			Double minValue,
			Double maxValue,
			Boolean usableInAlerts,
			Boolean usableInReports) {
	}

	public record MeasurementMetaDto(
			String code,
			String unit,
			String category,
			String description,
			String valueType,
			Integer decimals,
			Double minValue,
			Double maxValue,
			boolean usableInAlerts,
			boolean usableInReports) {
		public static MeasurementMetaDto from(MeasurementTypeMetaEntity e) {
			return new MeasurementMetaDto(
					e.getCode(),
					e.getUnit(),
					e.getCategory(),
					e.getDescription(),
					e.getValueType(),
					e.getDecimals(),
					e.getMinValue(),
					e.getMaxValue(),
					e.isUsableInAlerts(),
					e.isUsableInReports());
		}
	}

	public record ThresholdDto(String type, Double minWarn, Double minCrit) {
		public static ThresholdDto from(ThresholdConfigEntity e) {
			return new ThresholdDto(e.getType(), e.getMinWarn(), e.getMinCrit());
		}
	}

	public record CodeListDto(String name) {
	}

	public record CodeItemUpsertRequest(
			String labelFr,
			String labelHt,
			String labelEn,
			String color,
			Integer sortOrder,
			Boolean active) {
	}

	public record CodeItemDto(
			String listName,
			String code,
			String labelFr,
			String labelHt,
			String labelEn,
			String color,
			Integer sortOrder,
			boolean active) {
		public static CodeItemDto from(ReferenceCodeItemEntity e) {
			return new CodeItemDto(
				e.getListName(),
				e.getCode(),
				e.getLabelFr(),
				e.getLabelHt(),
				e.getLabelEn(),
				e.getColor(),
				e.getSortOrder(),
				e.isActive());
		}
	}

	private void validatePointType(String type) {
		if (type == null || type.isBlank()) {
			throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST, "type is required");
		}
		ReferenceCodeItemId id = new ReferenceCodeItemId("POINT_TYPE", type);
		ReferenceCodeItemEntity item = codeItems.findById(id).orElse(null);
		if (item == null || !item.isActive()) {
			throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown point type: " + type);
		}
	}
}
