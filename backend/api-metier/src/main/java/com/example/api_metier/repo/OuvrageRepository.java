package com.example.api_metier.repo;

import com.example.api_metier.domain.OuvrageEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OuvrageRepository extends JpaRepository<OuvrageEntity, String> {

    boolean existsByCode(String code);

    /** Périmètre superviseur : ouvrages d'un département (colonne dénormalisée). */
    List<OuvrageEntity> findByDepartmentIgnoreCase(String department);

    /** Périmètre fin du TEPAC : ouvrages de sa commune, tous statuts confondus. */
    List<OuvrageEntity> findByCommuneIgnoreCase(String commune);
}
