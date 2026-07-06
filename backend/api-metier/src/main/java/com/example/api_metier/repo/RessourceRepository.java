package com.example.api_metier.repo;

import com.example.api_metier.domain.RessourceEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RessourceRepository extends JpaRepository<RessourceEntity, String> {

    boolean existsByCode(String code);

    /** Périmètre fin du TEPAC : ressources de sa commune (colonne dénormalisée), tous statuts confondus. */
    List<RessourceEntity> findByCommuneIgnoreCase(String commune);
}
