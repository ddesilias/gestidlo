package com.example.api_metier.repo;

import com.example.api_metier.domain.InterventionPhotoEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterventionPhotoRepository extends JpaRepository<InterventionPhotoEntity, Long> {

	List<InterventionPhotoEntity> findByTicketIdOrderByTakenAtAsc(Long ticketId);
}
