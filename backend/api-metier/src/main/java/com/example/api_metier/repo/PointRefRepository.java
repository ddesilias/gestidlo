package com.example.api_metier.repo;

import com.example.api_metier.domain.PointRefEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PointRefRepository extends JpaRepository<PointRefEntity, String> {
	List<PointRefEntity> findByActiveTrueOrderByIdAsc();

	/** Points actifs d'une commune (périmètre fin TEPAC) — base du module capteurs. */
	List<PointRefEntity> findByCommuneIgnoreCaseAndActiveTrueOrderByIdAsc(String commune);

	/** Points actifs d'un département (territory = dept) — capteurs scopés URD. */
	List<PointRefEntity> findByTerritoryIgnoreCaseAndActiveTrueOrderByIdAsc(String territory);

	long countByType(String type);
}
