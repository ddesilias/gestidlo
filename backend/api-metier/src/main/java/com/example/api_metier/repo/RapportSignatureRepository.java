package com.example.api_metier.repo;

import com.example.api_metier.domain.RapportSignatureEntity;
import com.example.api_metier.domain.RapportSignatureEntity.Etat;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Registre des attestations d'examen (signatures gelées). Append-only côté usage : on lit,
 * on crée, on supersède — jamais de delete.
 */
public interface RapportSignatureRepository extends JpaRepository<RapportSignatureEntity, String> {

	/** Invariant TX (substitut à l'index partiel non généré par ddl-auto) : au plus une ACTIVE. */
	boolean existsByRapportIdAndEtat(String rapportId, Etat etat);

	/** La signature engageable d'un rapport (l'unique ACTIVE), pour la revérif de hash à signer(). */
	Optional<RapportSignatureEntity> findByRapportIdAndEtat(String rapportId, Etat etat);

	/** Chaîne d'audit complète d'un rapport, dans l'ordre des signatures. */
	List<RapportSignatureEntity> findByRapportIdOrderBySigneLeAsc(String rapportId);
}
