package com.example.api_metier.repo;

import com.example.api_metier.domain.ActeurEntity;
import com.example.api_metier.domain.ActeurType;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActeurRepository extends JpaRepository<ActeurEntity, String> {

    /** Acteurs vivants (non soft-deleted) d'un département. */
    List<ActeurEntity> findByDepartementIdAndSupprimeLeIsNull(String departementId);

    /** Acteurs vivants d'une commune (périmètre fin TEPAC) dans son département. */
    List<ActeurEntity> findByDepartementIdAndCommuneIgnoreCaseAndSupprimeLeIsNull(
            String departementId, String commune);

    /** Tous les acteurs vivants. */
    List<ActeurEntity> findBySupprimeLeIsNull();

    /** Unicité métier : un seul TEPAC / une seule mairie vivants par commune d'un département. */
    boolean existsByTypeAndDepartementIdAndCommuneIgnoreCaseAndSupprimeLeIsNull(
            ActeurType type, String departementId, String commune);
}
