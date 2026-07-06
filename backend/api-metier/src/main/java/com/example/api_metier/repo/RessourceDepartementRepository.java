package com.example.api_metier.repo;

import com.example.api_metier.domain.RessourceDepartementEntity;
import com.example.api_metier.domain.RessourceDepartementId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RessourceDepartementRepository
        extends JpaRepository<RessourceDepartementEntity, RessourceDepartementId> {

    /** Toutes les liaisons d'un département (ressources visibles dans la fiche URD). */
    List<RessourceDepartementEntity> findByIdDepartementId(String departementId);

    /** Toutes les liaisons d'une ressource (ses départements traversés). */
    List<RessourceDepartementEntity> findByIdRessourceId(String ressourceId);
}
