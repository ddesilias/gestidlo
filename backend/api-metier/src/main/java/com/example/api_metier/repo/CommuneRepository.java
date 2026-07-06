package com.example.api_metier.repo;

import com.example.api_metier.domain.CommuneEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommuneRepository extends JpaRepository<CommuneEntity, String> {

    /** Communes d'un département, triées par nom (périmètre imposé par le scope). */
    List<CommuneEntity> findByDepartementIdIgnoreCaseOrderByNomAsc(String departementId);

    List<CommuneEntity> findAllByOrderByNomAsc();
}
