package com.example.api_metier.repo;

import com.example.api_metier.domain.AlertEntity;
import com.example.api_metier.domain.AlertStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AlertRepository extends JpaRepository<AlertEntity, Long> {
	List<AlertEntity> findByStatus(AlertStatus status);

	/**
	 * Alertes d'un statut donné, scopées à un département. Le rattachement départemental
	 * se fait de DEUX façons, en union :
	 *   1. par le point de mesure (PointRefEntity.territory) — alertes nées d'un capteur ;
	 *   2. par la commune dénormalisée de l'alerte, dont le département est résolu via
	 *      CommuneEntity — indispensable pour les alertes SANS point de mesure : créées à la
	 *      main (pointId « MANUEL ») ou émises automatiquement par la boucle métier
	 *      (ressource POLLUÉE / ouvrage en PANNE). Sans cette branche, ces alertes n'étaient
	 *      visibles d'aucun superviseur.
	 * Le filtre est imposé côté serveur — il ne dépend pas de l'affichage client.
	 */
	@Query("select a from AlertEntity a where a.status = :status and ("
			+ "a.pointId in (select p.id from PointRefEntity p where p.territory = :dept) "
			+ "or lower(a.commune) in (select lower(c.nom) from CommuneEntity c where lower(c.departementId) = lower(:dept)))")
	List<AlertEntity> findByStatusAndDepartement(@Param("status") AlertStatus status, @Param("dept") String dept);

	/** Toutes les alertes d'un département (tous statuts) — pour l'inbox de triage scopée.
	 *  Même union point-de-mesure + commune→département que ci-dessus. */
	@Query("select a from AlertEntity a where ("
			+ "a.pointId in (select p.id from PointRefEntity p where p.territory = :dept) "
			+ "or lower(a.commune) in (select lower(c.nom) from CommuneEntity c where lower(c.departementId) = lower(:dept)))")
	List<AlertEntity> findByDepartement(@Param("dept") String dept);

	/** Périmètre fin TEPAC : alertes d'une commune (colonne dénormalisée, sans jointure). */
	List<AlertEntity> findByCommuneIgnoreCase(String commune);

	List<AlertEntity> findByStatusAndCommuneIgnoreCase(AlertStatus status, String commune);

	Optional<AlertEntity> findFirstByPointIdAndTypeAndStatusOrderByOpenedAtDesc(
			String pointId,
			String type,
			AlertStatus status);

	long countByType(String type);

	long countByPointId(String pointId);

	/** Un capteur est « en seuil dépassé » si son point porte une alerte ouverte (ACTIVE). */
	boolean existsByPointIdAndStatus(String pointId, AlertStatus status);
}
