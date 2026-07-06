package com.example.api_metier.repo;

import com.example.api_metier.domain.RapportEntity;
import com.example.api_metier.domain.RapportStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RapportRepository extends JpaRepository<RapportEntity, String> {

	/** Vue URD : rapports d'un département, jamais les nationaux. */
	List<RapportEntity> findByNationalFalseAndDepartementId(String departementId);

	List<RapportEntity> findByNationalFalseAndDepartementIdAndStatus(String departementId, RapportStatus status);

	/** Vue commune (périmètre fin TEPAC) : rapports d'une commune d'un département, jamais nationaux. */
	List<RapportEntity> findByNationalFalseAndDepartementIdAndCommuneIgnoreCase(String departementId, String commune);

	List<RapportEntity> findByNationalFalseAndDepartementIdAndCommuneIgnoreCaseAndStatus(
			String departementId, String commune, RapportStatus status);

	List<RapportEntity> findByStatus(RapportStatus status);
}
