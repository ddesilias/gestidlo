package com.example.api_metier.repo;

import com.example.api_metier.domain.MeasurementEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MeasurementRepository extends JpaRepository<MeasurementEntity, Long> {
	Optional<MeasurementEntity> findTop1ByPointIdAndTypeOrderByTimestampDesc(String pointId, String type);

	/** Dernière mesure (tous types) d'un point — état/valeur courante du capteur. */
	Optional<MeasurementEntity> findTop1ByPointIdOrderByTimestampDesc(String pointId);

	List<MeasurementEntity> findByPointIdAndTypeAndTimestampBetweenOrderByTimestampAsc(
			String pointId,
			String type,
			Instant from,
			Instant to);

	List<MeasurementEntity> findTop100ByPointIdOrderByTimestampDesc(String pointId);

	long countByType(String type);

	long countByPointId(String pointId);
}
