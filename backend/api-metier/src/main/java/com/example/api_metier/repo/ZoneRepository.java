package com.example.api_metier.repo;

import com.example.api_metier.domain.ZoneEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ZoneRepository extends JpaRepository<ZoneEntity, String> {

	List<ZoneEntity> findByDepartementId(String departementId);

	/** Zones d'une commune (périmètre fin TEPAC) dans son département. */
	List<ZoneEntity> findByDepartementIdAndCommuneIgnoreCase(String departementId, String commune);
}
