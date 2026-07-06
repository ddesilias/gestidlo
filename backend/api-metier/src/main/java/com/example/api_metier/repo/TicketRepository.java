package com.example.api_metier.repo;

import com.example.api_metier.domain.TicketEntity;
import com.example.api_metier.domain.TicketStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TicketRepository extends JpaRepository<TicketEntity, Long> {
	List<TicketEntity> findByStatus(TicketStatus status);

	long countByPointId(String pointId);

	/**
	 * Tickets d'un département — UNION de deux voies (mêmes que les alertes) :
	 *  (1) tickets nés d'alerte → département dérivé du point (PointRefEntity.territory) ;
	 *  (2) tickets à pointId synthétique (ORDRE de travail : OUV-/MANUEL-/RES-) → on retombe
	 *      sur la commune dénormalisée, rattachée au département via CommuneEntity.
	 * Sans (2), un ordre de travail créé par le superviseur (pointId = ouvrage) lui resterait
	 * invisible. Cf. la même réconciliation appliquée aux alertes.
	 */
	@Query("select t from TicketEntity t where "
			+ "t.pointId in (select p.id from PointRefEntity p where p.territory = :dept) "
			+ "or lower(t.commune) in (select lower(c.nom) from CommuneEntity c "
			+ "where lower(c.departementId) = lower(:dept))")
	List<TicketEntity> findByDepartement(@Param("dept") String dept);

	/** Périmètre fin TEPAC : tickets d'une commune (colonne dénormalisée, sans jointure). */
	List<TicketEntity> findByCommuneIgnoreCase(String commune);
}
