package com.example.api_metier;

import com.example.api_metier.domain.PointRefEntity;
import com.example.api_metier.domain.ReferenceCodeItemEntity;
import com.example.api_metier.domain.ThresholdConfigEntity;
import com.example.api_metier.domain.UserAccountEntity;
import com.example.api_metier.repo.PointRefRepository;
import com.example.api_metier.repo.ReferenceCodeItemRepository;
import com.example.api_metier.repo.ThresholdConfigRepository;
import com.example.api_metier.repo.UserAccountRepository;
import java.util.List;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootApplication
public class ApiMetierApplication {

	public static void main(String[] args) {
		SpringApplication.run(ApiMetierApplication.class, args);
	}

	@Bean
	CommandLineRunner seedReferenceData(
			PointRefRepository points,
			ThresholdConfigRepository thresholds,
			ReferenceCodeItemRepository codeItems,
			UserAccountRepository users,
			PasswordEncoder passwordEncoder,
			com.example.api_metier.service.MeasurementService measurementService,
			com.example.api_metier.repo.MeasurementRepository measurements) {
		return args -> {
			seedUserIfMissing(users, passwordEncoder, "admin", "admin", "ADMIN");
			seedUserIfMissing(users, passwordEncoder, "tech", "tech", "TECH");
			seedUserIfMissing(users, passwordEncoder, "operator", "operator", "OPERATOR");

			if (points.count() == 0) {
				// Coordinates are demo WGS84 (lat/lon in decimal degrees) located in major cities.
				points.save(new PointRefEntity("POINT-001", "KIOSK-01", "KIOSK", "Ouest", -72.34, 18.54, "Kiosque principal", true));
				points.save(new PointRefEntity("POINT-002", "SCHOOL", "SCHOOL", "Nord", -72.20, 19.76, "École / point critique", true));
				points.save(new PointRefEntity("POINT-003", "TANK", "TANK", "Sud-Est", -72.53, 18.23, "Réservoir", true));
				points.save(new PointRefEntity("POINT-004", "SOURCE-NE", "SOURCE", "Nord-Est", -71.84, 19.66, "Source (démo)", true));
				points.save(new PointRefEntity("POINT-005", "TANK-ART", "TANK", "Artibonite", -72.69, 19.45, "Réservoir (démo)", true));
				points.save(new PointRefEntity("POINT-006", "KIOSK-CEN", "KIOSK", "Centre", -72.02, 19.15, "Kiosque (démo)", true));
				points.save(new PointRefEntity("POINT-007", "SOURCE-NW", "SOURCE", "Nord-Ouest", -72.83, 19.94, "Source (démo)", true));
				points.save(new PointRefEntity("POINT-008", "KIOSK-SUD", "KIOSK", "Sud", -73.75, 18.20, "Kiosque (démo)", true));
				points.save(new PointRefEntity("POINT-009", "KIOSK-NIP", "KIOSK", "Nippes", -73.09, 18.44, "Kiosque (démo)", true));
				points.save(new PointRefEntity("POINT-010", "KIOSK-GA", "KIOSK", "Grand'Anse", -74.12, 18.64, "Kiosque (démo)", true));
			}

			if (thresholds.count() == 0) {
				thresholds.save(new ThresholdConfigEntity("PRESSURE", 2.0, 1.0));
				thresholds.save(new ThresholdConfigEntity("LEVEL", null, 10.0));
			}

			seedCodeList(codeItems, "ALERT_SEVERITY", List.of(
					new ReferenceCodeItemEntity("ALERT_SEVERITY", "INFO", "Info", "Info", "Info", "#16a34a", 10, true),
					new ReferenceCodeItemEntity("ALERT_SEVERITY", "WARN", "Avertissement", "Avètisman", "Warning", "#f59e0b", 20, true),
					new ReferenceCodeItemEntity("ALERT_SEVERITY", "CRIT", "Critique", "Kritik", "Critical", "#dc2626", 30, true)));

			seedCodeList(codeItems, "ALERT_STATUS", List.of(
					new ReferenceCodeItemEntity("ALERT_STATUS", "ACTIVE", "Active", "Aktif", "Active", "#dc2626", 10, true),
					new ReferenceCodeItemEntity("ALERT_STATUS", "ACK", "Acquittée", "Asepte", "Acknowledged", "#f59e0b", 20, true),
					new ReferenceCodeItemEntity("ALERT_STATUS", "CLOSED", "Clôturée", "Fèmen", "Closed", "#16a34a", 30, true)));

			seedCodeList(codeItems, "TICKET_STATUS", List.of(
					new ReferenceCodeItemEntity("TICKET_STATUS", "OPEN", "À traiter", "Pou trete", "Open", "#f59e0b", 10, true),
					new ReferenceCodeItemEntity("TICKET_STATUS", "ASSIGNED", "Assignée", "Bay", "Assigned", "#f59e0b", 20, true),
					new ReferenceCodeItemEntity("TICKET_STATUS", "IN_PROGRESS", "En cours", "An kour", "In progress", "#dc2626", 30, true),
					new ReferenceCodeItemEntity("TICKET_STATUS", "CLOSED", "Clôturée", "Fèmen", "Closed", "#16a34a", 40, true)));

			seedCodeList(codeItems, "MEASUREMENT_TYPE", List.of(
					new ReferenceCodeItemEntity("MEASUREMENT_TYPE", "PRESSURE", "Pression", "Presyon", "Pressure", "#2563eb", 10, true),
					new ReferenceCodeItemEntity("MEASUREMENT_TYPE", "LEVEL", "Niveau", "Nivo", "Level", "#2563eb", 20, true),
					new ReferenceCodeItemEntity("MEASUREMENT_TYPE", "FLOW", "Débit", "Debi", "Flow", "#2563eb", 30, true)));

			if (measurements.count() == 0) {
				seedDemoMeasurements(measurementService);
			}

			seedCodeList(codeItems, "POINT_TYPE", List.of(
					new ReferenceCodeItemEntity("POINT_TYPE", "KIOSK", "Kiosque", "Kiosk", "Kiosk", "#2563eb", 10, true),
					new ReferenceCodeItemEntity("POINT_TYPE", "SCHOOL", "École", "Lekòl", "School", "#2563eb", 20, true),
					new ReferenceCodeItemEntity("POINT_TYPE", "TANK", "Réservoir", "Tank", "Tank", "#2563eb", 30, true),
					new ReferenceCodeItemEntity("POINT_TYPE", "SOURCE", "Source", "Sous", "Source", "#2563eb", 40, true)));
		};
	}

	private void seedCodeList(ReferenceCodeItemRepository repo, String listName, List<ReferenceCodeItemEntity> items) {
		if (repo.countByIdListName(listName) > 0) {
			return;
		}
		repo.saveAll(items);
	}

	private void seedUserIfMissing(
			UserAccountRepository repo,
			PasswordEncoder passwordEncoder,
			String username,
			String rawPassword,
			String roles) {
		if (repo.existsById(username)) {
			return;
		}
		repo.save(new UserAccountEntity(
				username,
				passwordEncoder.encode(rawPassword),
				roles,
				true));
	}

	private void seedDemoMeasurements(com.example.api_metier.service.MeasurementService measurementService) {
		java.time.Instant now = java.time.Instant.now().minusSeconds(30);
		java.util.List<com.example.api_metier.service.MeasurementService.IngestRequest> rows = java.util.List.of(
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-001", "S1", "PRESSURE", 2.6, "bar", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-002", "S1", "PRESSURE", 0.7, "bar", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-003", "S1", "LEVEL", 8.0, "cm", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-004", "S1", "FLOW", 12.0, "l/s", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-005", "S1", "PRESSURE", 1.6, "bar", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-006", "S1", "PRESSURE", 2.2, "bar", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-007", "S1", "FLOW", 6.0, "l/s", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-008", "S1", "PRESSURE", 2.1, "bar", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-009", "S1", "PRESSURE", 1.2, "bar", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-010", "S1", "PRESSURE", 2.4, "bar", now));
		for (var r : rows) {
			try {
				measurementService.ingest(r);
			} catch (Exception ignored) {
				// best-effort demo
			}
		}
	}

}
