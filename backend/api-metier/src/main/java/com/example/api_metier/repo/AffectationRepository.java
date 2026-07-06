package com.example.api_metier.repo;

import com.example.api_metier.domain.AffectationEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AffectationRepository extends JpaRepository<AffectationEntity, Long> {

    /** Affectations OUVERTES d'une intervention (ticket). */
    List<AffectationEntity> findByTicketIdAndClosedAtIsNull(Long ticketId);

    /** Toutes les affectations d'une intervention (historique compris). */
    List<AffectationEntity> findByTicketId(Long ticketId);

    /** Affectations ouvertes d'une personne (pour dériver « sur intervention »). */
    List<AffectationEntity> findByPersonneUsernameAndClosedAtIsNull(String personneUsername);

    /** Garde-fou idempotence : la personne est-elle déjà affectée (ouverte) à ce ticket ? */
    boolean existsByTicketIdAndPersonneUsernameAndClosedAtIsNull(Long ticketId, String personneUsername);

    /** Toutes les affectations ouvertes des tickets d'un périmètre (in-clause sur ids scopés). */
    List<AffectationEntity> findByTicketIdInAndClosedAtIsNull(List<Long> ticketIds);

    /** Toutes les affectations ouvertes (filtrées ensuite par commune scopée en mémoire). */
    List<AffectationEntity> findByClosedAtIsNull();
}
