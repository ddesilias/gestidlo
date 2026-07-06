package com.example.api_metier.repo;

import com.example.api_metier.domain.CapteurEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CapteurRepository extends JpaRepository<CapteurEntity, String> {

    boolean existsByCode(String code);

    /** Unicité du device physique : éviter qu'un même ESP32 soit déclaré deux fois. */
    boolean existsByDeviceIdIgnoreCase(String deviceId);

    /** Corrélation de l'ingestion temps réel : un message porte le {@code sensorCode}. */
    Optional<CapteurEntity> findByCodeIgnoreCase(String code);

    /** Périmètre superviseur : capteurs d'un département. */
    List<CapteurEntity> findByDepartmentIgnoreCaseOrderByCodeAsc(String department);

    /** Périmètre fin du TEPAC : capteurs de sa commune, tous statuts confondus. */
    List<CapteurEntity> findByCommuneIgnoreCaseOrderByCodeAsc(String commune);

    List<CapteurEntity> findAllByOrderByCodeAsc();
}
