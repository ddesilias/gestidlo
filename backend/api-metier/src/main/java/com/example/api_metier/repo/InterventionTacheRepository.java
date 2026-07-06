package com.example.api_metier.repo;

import com.example.api_metier.domain.InterventionTacheEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterventionTacheRepository extends JpaRepository<InterventionTacheEntity, Long> {

	List<InterventionTacheEntity> findByTicketIdOrderByOrdreAsc(Long ticketId);
}
