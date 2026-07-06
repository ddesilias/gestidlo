package com.example.api_metier.config;

import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Migration légère au démarrage (H2 + ddl-auto=update).
 *
 * <p>Hibernate crée, pour une colonne {@code @Enumerated(STRING)}, une CHECK constraint figeant
 * les valeurs autorisées au moment de la création de la table. La table {@code tickets} portait
 * donc {@code status IN ('OPEN','ASSIGNED','IN_PROGRESS','CLOSED')}. Comme {@code ddl-auto=update}
 * ne met JAMAIS à jour une contrainte existante, l'extension du workflow ({@code BROUILLON},
 * {@code ENVOYEE}, …) la violait (H2 23513). On retire ici la CHECK périmée — l'intégrité des
 * valeurs reste garantie par l'enum Java {@code TicketStatus}. Idempotent : no-op une fois retirée.
 */
@Component
@Order(0)
public class TicketStatusConstraintMigration implements ApplicationRunner {

	private final JdbcTemplate jdbc;

	public TicketStatusConstraintMigration(DataSource dataSource) {
		this.jdbc = new JdbcTemplate(dataSource);
	}

	@Override
	public void run(ApplicationArguments args) {
		List<Map<String, Object>> rows;
		try {
			rows = jdbc.queryForList(
					"SELECT CONSTRAINT_NAME, CHECK_CLAUSE FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS");
		} catch (Exception e) {
			return; // dialecte sans cette vue : rien à faire
		}
		for (Map<String, Object> row : rows) {
			Object clauseObj = row.get("CHECK_CLAUSE");
			Object nameObj = row.get("CONSTRAINT_NAME");
			if (clauseObj == null || nameObj == null) {
				continue;
			}
			String clause = clauseObj.toString().toUpperCase();
			// Cible précise : la CHECK du statut de ticket (référence STATUS + ancienne valeur OPEN).
			if (clause.contains("STATUS") && clause.contains("OPEN") && clause.contains("CLOSED")) {
				try {
					jdbc.execute("ALTER TABLE TICKETS DROP CONSTRAINT IF EXISTS \"" + nameObj + "\"");
				} catch (Exception ignored) {
					// contrainte déjà absente ou nom inattendu : sans gravité
				}
			}
		}

		// Rétro-remplissage : les tickets existants (nés d'alerte, KIND null) deviennent ALERTE.
		try {
			jdbc.update("UPDATE TICKETS SET KIND = 'ALERTE' WHERE KIND IS NULL");
		} catch (Exception ignored) {
			// colonne pas encore présente / dialecte différent : sans gravité
		}

		// Nettoyage : anciennes tables renommées vers ticket_tache / ticket_photo (données de test).
		for (String old : new String[] { "INTERVENTION_TACHE", "INTERVENTION_PHOTO" }) {
			try {
				jdbc.execute("DROP TABLE IF EXISTS " + old);
			} catch (Exception ignored) {
				// déjà absente : sans gravité
			}
		}
	}
}
