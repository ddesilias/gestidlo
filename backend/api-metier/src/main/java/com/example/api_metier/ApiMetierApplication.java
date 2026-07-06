package com.example.api_metier;

import com.example.api_metier.domain.AlertEntity;
import com.example.api_metier.domain.AlertSeverity;
import com.example.api_metier.domain.AlertStatus;
import com.example.api_metier.domain.ActeurEntity;
import com.example.api_metier.domain.ActeurType;
import com.example.api_metier.domain.PointRefEntity;
import com.example.api_metier.domain.RapportEntity;
import com.example.api_metier.domain.RapportStatus;
import com.example.api_metier.domain.ReferenceCodeItemEntity;
import com.example.api_metier.domain.RessourceDepartementEntity;
import com.example.api_metier.domain.RessourceEntity;
import com.example.api_metier.domain.RessourceEtat;
import com.example.api_metier.domain.RessourceStatut;
import com.example.api_metier.domain.RessourceType;
import com.example.api_metier.domain.ThresholdConfigEntity;
import com.example.api_metier.domain.UserAccountEntity;
import com.example.api_metier.domain.UserProfileEntity;
import com.example.api_metier.domain.ZoneEntity;
import com.example.api_metier.domain.ZoneStatus;
import com.example.api_metier.repo.AlertRepository;
import com.example.api_metier.repo.ActeurRepository;
import com.example.api_metier.repo.PointRefRepository;
import com.example.api_metier.repo.RapportRepository;
import com.example.api_metier.repo.ReferenceCodeItemRepository;
import com.example.api_metier.repo.RessourceDepartementRepository;
import com.example.api_metier.repo.RessourceRepository;
import com.example.api_metier.repo.ThresholdConfigRepository;
import com.example.api_metier.repo.UserAccountRepository;
import com.example.api_metier.repo.UserProfileRepository;
import com.example.api_metier.repo.ZoneRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.crypto.password.PasswordEncoder;

@SpringBootApplication
public class ApiMetierApplication {

	public static void main(String[] args) {
		SpringApplication.run(ApiMetierApplication.class, args);
	}

	@Bean
	CommandLineRunner seedReferenceData(
			PointRefRepository points,
			ThresholdConfigRepository thresholds,
			ReferenceCodeItemRepository codeItems,
			UserAccountRepository users,
			UserProfileRepository profiles,
			AlertRepository alerts,
			ActeurRepository acteurs,
			RessourceRepository ressources,
			RessourceDepartementRepository ressourceDepts,
			com.example.api_metier.repo.OuvrageRepository ouvrages,
			com.example.api_metier.repo.CapteurRepository capteursRepo,
			RapportRepository rapportsRepo,
			ZoneRepository zonesRepo,
			PasswordEncoder passwordEncoder,
			com.example.api_metier.service.MeasurementService measurementService,
			com.example.api_metier.service.RapportRedactionService rapportRedaction,
			com.example.api_metier.repo.MeasurementRepository measurements,
			com.example.api_metier.repo.TicketRepository ticketsRepo,
			com.example.api_metier.repo.CommuneRepository communeRepo) {
		return args -> {
			// Connexion par email : chaque compte loginable doit avoir un profil (source unique) avec email.
			// Le superviseur est verrouillé sur son URD via urdId/dept embarqués dans le token.
			seedUser(users, profiles, passwordEncoder,
					"admin", "admin@dinepa.ht", "admin", "ADMIN", "admin_dinepa",
					"Administrateur DINEPA", null, null);
			seedUser(users, profiles, passwordEncoder,
					"superviseur", "superviseur@dinepa.ht", "superviseur", "SUPERVISEUR_URD", "superviseur_urd",
					"Maria Romain", "URD-NORD", "Nord");
			// Superviseur Sud-Est (« Kelly ») : son périmètre coïncide avec le jeu de données seedé,
			// donc dashboard + carte + rapports s'allument de façon cohérente (≠ Ouest/Nord = vides).
			seedUser(users, profiles, passwordEncoder,
					"kelly", "kelly@dinepa.ht", "kelly", "SUPERVISEUR_URD", "superviseur_urd",
					"Kelly Joseph", "URD-SUD-EST", "Sud-Est");
			// Superviseur Ouest (« Doune Deri ») : son dropdown communes affichera les 20 de l'Ouest.
			seedUser(users, profiles, passwordEncoder,
					"doune", "doune@dinepa.ht", "doune", "SUPERVISEUR_URD", "superviseur_urd",
					"Doune Deri", "URD-OUEST", "Ouest");

			// Communes administratives (source unique des dropdowns, scopées par département).
			seedCommunes(communeRepo);
			seedUser(users, profiles, passwordEncoder,
					"tech", "tech@dinepa.ht", "tech", "TECH", "technicien",
					"Technicien Nord", "URD-NORD", "Nord");
			seedUser(users, profiles, passwordEncoder,
					"operator", "operator@dinepa.ht", "operator", "OPERATOR", "operateur",
					"Opérateur démo", null, null);
			// TEPAC démo (Jean Pierre) verrouillé sur la commune de Jacmel (URD Sud-Est) : login par
			// email, rôle TEPAC, périmètre fin = commune. Ne voit QUE les alertes/tickets de Jacmel.
			seedTepac(users, profiles, passwordEncoder,
					"jeanpierre", "jeanpierre@gestidlo.ht", "Jean@12345",
					"Jean Pierre", "URD-SUD-EST", "Sud-Est", "Jacmel");
			// TEPAC démo Carrefour (URD Ouest) : l'autre bout du cycle de recensement. Avec le superviseur
			// « Doune Deri » (URD-OUEST), il rend démontrable recensement → validation/rejet → notif retour.
			seedTepac(users, profiles, passwordEncoder,
					"tcarrefour", "tepac.carrefour@gestidlo.ht", "Carrefour@123",
					"TEPAC Carrefour", "URD-OUEST", "Ouest", "Carrefour");

			// Purge one-shot des alertes/tickets de test (« Test alerte ») créés en validation manuelle.
			purgeTestData(alerts, ticketsRepo);

			// Jeu de données vérifiable pour l'URD Sud-Est (+ une miette de voisin) — voir seedSudEst.
			seedSudEst(points, alerts, acteurs, ressources, ressourceDepts, measurements, ticketsRepo);
			seedRapportsSudEst(rapportsRepo);
			seedRapportsTerrainOuest(rapportsRepo, rapportRedaction);
			seedZonesSudEst(zonesRepo);
			seedOuvragesOuest(ouvrages);
			seedCapteurs(capteursRepo);
			aligneStationCarrefour(capteursRepo);
			seedReservoirJacmel(ouvrages, capteursRepo);
			seedStationDelmas(ouvrages, capteursRepo);

			if (points.count() == 0) {
				// Coordinates are demo WGS84 (lat/lon in decimal degrees) located in major cities.
				points.save(new PointRefEntity("POINT-001", "KIOSK-01", "KIOSK", "Ouest", -72.34, 18.54, "Kiosque principal", true));
				points.save(new PointRefEntity("POINT-002", "SCHOOL", "SCHOOL", "Nord", -72.20, 19.76, "École / point critique", true));
				points.save(new PointRefEntity("POINT-003", "TANK", "TANK", "Sud-Est", -72.53, 18.23, "Réservoir", true));
				points.save(new PointRefEntity("POINT-004", "SOURCE-NE", "SOURCE", "Nord-Est", -71.84, 19.66, "Source (démo)", true));
				points.save(new PointRefEntity("POINT-005", "TANK-ART", "TANK", "Artibonite", -72.69, 19.45, "Réservoir (démo)", true));
				points.save(new PointRefEntity("POINT-006", "KIOSK-CEN", "KIOSK", "Centre", -72.02, 19.15, "Kiosque (démo)", true));
				points.save(new PointRefEntity("POINT-007", "SOURCE-NW", "SOURCE", "Nord-Ouest", -72.83, 19.94, "Source (démo)", true));
				points.save(new PointRefEntity("POINT-008", "KIOSK-SUD", "KIOSK", "Sud", -73.75, 18.20, "Kiosque (démo)", true));
				points.save(new PointRefEntity("POINT-009", "KIOSK-NIP", "KIOSK", "Nippes", -73.09, 18.44, "Kiosque (démo)", true));
				points.save(new PointRefEntity("POINT-010", "KIOSK-GA", "KIOSK", "Grand'Anse", -74.12, 18.64, "Kiosque (démo)", true));
			}

			if (thresholds.count() == 0) {
				thresholds.save(new ThresholdConfigEntity("PRESSURE", 2.0, 1.0));
				thresholds.save(new ThresholdConfigEntity("LEVEL", null, 10.0));
			}

			seedCodeList(codeItems, "ALERT_SEVERITY", List.of(
					new ReferenceCodeItemEntity("ALERT_SEVERITY", "INFO", "Info", "Info", "Info", "#16a34a", 10, true),
					new ReferenceCodeItemEntity("ALERT_SEVERITY", "WARN", "Avertissement", "Avètisman", "Warning", "#f59e0b", 20, true),
					new ReferenceCodeItemEntity("ALERT_SEVERITY", "CRIT", "Critique", "Kritik", "Critical", "#dc2626", 30, true)));

			seedCodeList(codeItems, "ALERT_STATUS", List.of(
					new ReferenceCodeItemEntity("ALERT_STATUS", "ACTIVE", "Active", "Aktif", "Active", "#dc2626", 10, true),
					new ReferenceCodeItemEntity("ALERT_STATUS", "ACK", "Acquittée", "Asepte", "Acknowledged", "#f59e0b", 20, true),
					new ReferenceCodeItemEntity("ALERT_STATUS", "CLOSED", "Clôturée", "Fèmen", "Closed", "#16a34a", 30, true)));

			seedCodeList(codeItems, "TICKET_STATUS", List.of(
					new ReferenceCodeItemEntity("TICKET_STATUS", "OPEN", "À traiter", "Pou trete", "Open", "#f59e0b", 10, true),
					new ReferenceCodeItemEntity("TICKET_STATUS", "ASSIGNED", "Assignée", "Bay", "Assigned", "#f59e0b", 20, true),
					new ReferenceCodeItemEntity("TICKET_STATUS", "IN_PROGRESS", "En cours", "An kour", "In progress", "#dc2626", 30, true),
					new ReferenceCodeItemEntity("TICKET_STATUS", "CLOSED", "Clôturée", "Fèmen", "Closed", "#16a34a", 40, true)));

			seedCodeList(codeItems, "MEASUREMENT_TYPE", List.of(
					new ReferenceCodeItemEntity("MEASUREMENT_TYPE", "PRESSURE", "Pression", "Presyon", "Pressure", "#2563eb", 10, true),
					new ReferenceCodeItemEntity("MEASUREMENT_TYPE", "LEVEL", "Niveau", "Nivo", "Level", "#2563eb", 20, true),
					new ReferenceCodeItemEntity("MEASUREMENT_TYPE", "FLOW", "Débit", "Debi", "Flow", "#2563eb", 30, true)));

			if (measurements.count() == 0) {
				seedDemoMeasurements(measurementService);
			}

			seedCodeList(codeItems, "POINT_TYPE", List.of(
					new ReferenceCodeItemEntity("POINT_TYPE", "KIOSK", "Kiosque", "Kiosk", "Kiosk", "#2563eb", 10, true),
					new ReferenceCodeItemEntity("POINT_TYPE", "SCHOOL", "École", "Lekòl", "School", "#2563eb", 20, true),
					new ReferenceCodeItemEntity("POINT_TYPE", "TANK", "Réservoir", "Tank", "Tank", "#2563eb", 30, true),
					new ReferenceCodeItemEntity("POINT_TYPE", "SOURCE", "Source", "Sous", "Source", "#2563eb", 40, true)));
		};
	}

	private void seedCodeList(ReferenceCodeItemRepository repo, String listName, List<ReferenceCodeItemEntity> items) {
		if (repo.countByIdListName(listName) > 0) {
			return;
		}
		repo.saveAll(items);
	}

	/**
	 * Seed idempotent du couple compte d'auth + profil métier.
	 * - crée le compte si absent ;
	 * - corrige le rôle Spring d'un compte existant (ex. superviseur OPERATOR -> SUPERVISEUR_URD
	 *   sur une base déjà initialisée) ;
	 * - crée le profil (email, urdId, dept) s'il manque — indispensable au login par email.
	 */
	private void seedUser(
			UserAccountRepository accounts,
			UserProfileRepository profiles,
			PasswordEncoder passwordEncoder,
			String username, String email, String rawPassword,
			String springRole, String businessRole, String nom,
			String urdId, String dept) {

		UserAccountEntity account = accounts.findById(username).orElse(null);
		if (account == null) {
			accounts.save(new UserAccountEntity(username, passwordEncoder.encode(rawPassword), springRole, true));
		} else if (!springRole.equals(account.getRoles())) {
			account.setRoles(springRole);
			accounts.save(account);
		}

		if (!profiles.existsById(username)) {
			profiles.save(new UserProfileEntity(
					username, nom, email, null, businessRole, businessRole, initialesOf(nom),
					urdId, null, dept, null, "seed"));
		}
	}

	/**
	 * Compte TEPAC démo : compte d'auth (rôle TEPAC, mot de passe haché) + profil avec
	 * commune renseignée — c'est elle qui partira dans le JWT et bornera le périmètre.
	 */
	private void seedTepac(
			UserAccountRepository accounts,
			UserProfileRepository profiles,
			PasswordEncoder passwordEncoder,
			String username, String email, String rawPassword, String nom,
			String urdId, String dept, String commune) {

		if (accounts.findById(username).isEmpty()) {
			accounts.save(new UserAccountEntity(username, passwordEncoder.encode(rawPassword), "TEPAC", true));
		}
		if (!profiles.existsById(username)) {
			UserProfileEntity p = new UserProfileEntity(
					username, nom, email, null, "Technicien TEPAC — commune " + commune,
					"tepac", initialesOf(nom), urdId, null, dept, "recenser,ouvrages", "seed");
			p.setCommune(commune);
			profiles.save(p);
		}
	}

	/** Point de mesure avec commune dénormalisée (description = commune, conservé pour l'affichage). */
	private void seedPoint(PointRefRepository points, String id, String name, String type,
			String dept, String commune, double lon, double lat) {
		PointRefEntity p = new PointRefEntity(id, name, type, dept, lon, lat, commune, true);
		p.setCommune(commune);
		points.save(p);
	}

	/**
	 * Référentiel COMPLET des communes — source unique des dropdowns, scopées par département.
	 * Les 10 départements d'Haïti, ossature canonique IHSI = 140 communes (à réconcilier avec
	 * les ~6 communes les plus récentes pour la prod). Idempotent par-commune (complète une
	 * base déjà partiellement seedée sans doublon).
	 */
	private void seedCommunes(com.example.api_metier.repo.CommuneRepository communes) {
		// ── Ouest (20) ──
		seedCommune(communes, "Ouest", "Port-au-Prince",
				List.of("Port-au-Prince", "Delmas", "Carrefour", "Pétion-Ville", "Kenscoff", "Gressier", "Tabarre", "Cité Soleil"));
		seedCommune(communes, "Ouest", "Léogâne", List.of("Léogâne", "Grand-Goâve", "Petit-Goâve"));
		seedCommune(communes, "Ouest", "Croix-des-Bouquets",
				List.of("Croix-des-Bouquets", "Ganthier", "Thomazeau", "Cornillon", "Fonds-Verrettes"));
		seedCommune(communes, "Ouest", "Arcahaie", List.of("Arcahaie", "Cabaret"));
		seedCommune(communes, "Ouest", "La Gonâve", List.of("Anse-à-Galets", "Pointe-à-Raquette"));
		// ── Sud-Est (10) ──
		seedCommune(communes, "Sud-Est", "Jacmel", List.of("Jacmel", "Marigot", "Cayes-Jacmel", "La Vallée"));
		seedCommune(communes, "Sud-Est", "Bainet", List.of("Bainet", "Côtes-de-Fer"));
		seedCommune(communes, "Sud-Est", "Belle-Anse", List.of("Belle-Anse", "Grand-Gosier", "Thiotte", "Anse-à-Pitres"));
		// ── Nord (19) ──
		seedCommune(communes, "Nord", "Cap-Haïtien", List.of("Cap-Haïtien", "Quartier-Morin", "Limonade"));
		seedCommune(communes, "Nord", "Acul-du-Nord", List.of("Acul-du-Nord", "Plaine-du-Nord", "Milot"));
		seedCommune(communes, "Nord", "Grande-Rivière-du-Nord", List.of("Grande-Rivière-du-Nord", "Bahon"));
		seedCommune(communes, "Nord", "Saint-Raphaël", List.of("Saint-Raphaël", "Dondon", "Ranquitte", "Pignon", "La Victoire"));
		seedCommune(communes, "Nord", "Borgne", List.of("Le Borgne", "Port-Margot"));
		seedCommune(communes, "Nord", "Plaisance", List.of("Plaisance", "Pilate"));
		seedCommune(communes, "Nord", "Limbé", List.of("Limbé", "Bas-Limbé"));
		// ── Nord-Est (13) ──
		seedCommune(communes, "Nord-Est", "Fort-Liberté", List.of("Fort-Liberté", "Ferrier", "Perches"));
		seedCommune(communes, "Nord-Est", "Ouanaminthe", List.of("Ouanaminthe", "Capotille", "Mont-Organisé"));
		seedCommune(communes, "Nord-Est", "Trou-du-Nord", List.of("Trou-du-Nord", "Caracol", "Sainte-Suzanne", "Terrier-Rouge"));
		seedCommune(communes, "Nord-Est", "Vallières", List.of("Vallières", "Carice", "Mombin-Crochu"));
		// ── Artibonite (15) ──
		seedCommune(communes, "Artibonite", "Dessalines", List.of("Dessalines", "Petite-Rivière-de-l'Artibonite", "Grande-Saline", "Desdunes"));
		seedCommune(communes, "Artibonite", "Gonaïves", List.of("Gonaïves", "Ennery", "L'Estère"));
		seedCommune(communes, "Artibonite", "Gros-Morne", List.of("Gros-Morne", "Anse-Rouge", "Terre-Neuve"));
		seedCommune(communes, "Artibonite", "Marmelade", List.of("Marmelade", "Saint-Michel-de-l'Attalaye"));
		seedCommune(communes, "Artibonite", "Saint-Marc", List.of("Saint-Marc", "La Chapelle", "Verrettes"));
		// ── Centre (12) ──
		seedCommune(communes, "Centre", "Hinche", List.of("Hinche", "Maïssade", "Thomonde", "Cerca-Carvajal"));
		seedCommune(communes, "Centre", "Mirebalais", List.of("Mirebalais", "Saut-d'Eau", "Boucan-Carré"));
		seedCommune(communes, "Centre", "Lascahobas", List.of("Lascahobas", "Belladère", "Savanette"));
		seedCommune(communes, "Centre", "Cerca-la-Source", List.of("Cerca-la-Source", "Thomassique"));
		// ── Sud (18) ──
		seedCommune(communes, "Sud", "Les Cayes", List.of("Les Cayes", "Torbeck", "Chantal", "Camp-Perrin", "Maniche", "Île-à-Vache"));
		seedCommune(communes, "Sud", "Aquin", List.of("Aquin", "Cavaillon", "Saint-Louis-du-Sud"));
		seedCommune(communes, "Sud", "Côteaux", List.of("Côteaux", "Port-à-Piment", "Roche-à-Bateau"));
		seedCommune(communes, "Sud", "Port-Salut", List.of("Port-Salut", "Saint-Jean-du-Sud", "Arniquet"));
		seedCommune(communes, "Sud", "Chardonnières", List.of("Chardonnières", "Les Anglais", "Tiburon"));
		// ── Grand'Anse (12) ──
		seedCommune(communes, "Grand'Anse", "Jérémie", List.of("Jérémie", "Abricots", "Bonbon", "Moron", "Chambellan"));
		seedCommune(communes, "Grand'Anse", "Corail", List.of("Corail", "Roseaux", "Pestel", "Beaumont"));
		seedCommune(communes, "Grand'Anse", "Anse-d'Hainault", List.of("Anse-d'Hainault", "Les Irois", "Dame-Marie"));
		// ── Nord-Ouest (10) ──
		seedCommune(communes, "Nord-Ouest", "Port-de-Paix", List.of("Port-de-Paix", "Bassin-Bleu", "Chansolme", "La Tortue"));
		seedCommune(communes, "Nord-Ouest", "Saint-Louis-du-Nord", List.of("Saint-Louis-du-Nord", "Anse-à-Foleur"));
		seedCommune(communes, "Nord-Ouest", "Môle-Saint-Nicolas", List.of("Môle-Saint-Nicolas", "Baie-de-Henne", "Bombardopolis", "Jean-Rabel"));
		// ── Nippes (11) ──
		seedCommune(communes, "Nippes", "Miragoâne", List.of("Miragoâne", "Petite-Rivière-de-Nippes", "Fonds-des-Nègres", "Paillant"));
		seedCommune(communes, "Nippes", "Anse-à-Veau", List.of("Anse-à-Veau", "Arnaud", "Petit-Trou-de-Nippes", "L'Asile", "Plaisance-du-Sud"));
		seedCommune(communes, "Nippes", "Baradères", List.of("Baradères", "Grand-Boucan"));
	}

	private void seedCommune(com.example.api_metier.repo.CommuneRepository communes,
			String dept, String arrondissement, List<String> noms) {
		for (String nom : noms) {
			String id = dept + "-" + nom;
			if (!communes.existsById(id)) {
				communes.save(new com.example.api_metier.domain.CommuneEntity(id, nom, arrondissement, dept));
			}
		}
	}

	private String initialesOf(String nom) {
		if (nom == null || nom.isBlank()) return "?";
		String[] parts = nom.trim().split("\\s+");
		StringBuilder sb = new StringBuilder();
		for (int i = 0; i < Math.min(parts.length, 2); i++) {
			if (!parts[i].isEmpty()) sb.append(parts[i].charAt(0));
		}
		return sb.toString().toUpperCase();
	}

	private void seedDemoMeasurements(com.example.api_metier.service.MeasurementService measurementService) {
		java.time.Instant now = java.time.Instant.now().minusSeconds(30);
		java.util.List<com.example.api_metier.service.MeasurementService.IngestRequest> rows = java.util.List.of(
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-001", "S1", "PRESSURE", 2.6, "bar", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-002", "S1", "PRESSURE", 0.7, "bar", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-003", "S1", "LEVEL", 8.0, "cm", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-004", "S1", "FLOW", 12.0, "l/s", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-005", "S1", "PRESSURE", 1.6, "bar", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-006", "S1", "PRESSURE", 2.2, "bar", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-007", "S1", "FLOW", 6.0, "l/s", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-008", "S1", "PRESSURE", 2.1, "bar", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-009", "S1", "PRESSURE", 1.2, "bar", now),
				new com.example.api_metier.service.MeasurementService.IngestRequest("POINT-010", "S1", "PRESSURE", 2.4, "bar", now));
		for (var r : rows) {
			try {
				measurementService.ingest(r);
			} catch (Exception ignored) {
				// best-effort demo
			}
		}
	}

	/**
	 * Jeu de données vérifiable pour l'URD Sud-Est, seedé PAR LE GRAPHE :
	 * on crée de vrais points de mesure (territory = Sud-Est) puis on rattache les
	 * alertes à ces points — le département de l'alerte est DÉRIVÉ (point.territory),
	 * jamais stampé. Une miette de voisin (Sud) prouve que le scope exclut réellement,
	 * au lieu d'être vrai trivialement. Idempotent (marqueur SE-MARIGOT-01).
	 * Alertes : 3 à traiter (ACTIVE) · 2 en cours (ACK) · 3 traitées (CLOSED) + 1 voisin.
	 */
	private void seedSudEst(PointRefRepository points, AlertRepository alerts,
			ActeurRepository acteurs, RessourceRepository ressources,
			RessourceDepartementRepository ressourceDepts,
			com.example.api_metier.repo.MeasurementRepository measurements,
			com.example.api_metier.repo.TicketRepository tickets) {

		if (points.findById("SE-MARIGOT-01").isPresent()) {
			return;
		}
		final String SE = "Sud-Est";

		// 1) Points du Sud-Est — territory = département (dérivation dept) ; commune = périmètre fin TEPAC.
		seedPoint(points, "SE-MARIGOT-01",   "Forage Marigot",         "SOURCE", SE,    "Marigot",      -72.323, 18.232);
		seedPoint(points, "SE-THIOTTE-01",   "Source Thiotte",         "SOURCE", SE,    "Thiotte",      -71.850, 18.240);
		seedPoint(points, "SE-JACMEL-01",    "Réservoir Jacmel",       "TANK",   SE,    "Jacmel",       -72.534, 18.234);
		seedPoint(points, "SE-JACMEL-02",    "Réservoir Lamandou",     "TANK",   SE,    "Jacmel",       -72.520, 18.236);
		seedPoint(points, "SE-JACMEL-03",    "Captage Raymond",        "SOURCE", SE,    "Jacmel",       -72.548, 18.250);
		// Capteurs Jacmel sans alerte : l'un remonte une mesure récente (→ OK), l'autre muet (→ hors ligne).
		seedPoint(points, "SE-JACMEL-04",    "Borne Lamandou",         "KIOSK",  SE,    "Jacmel",       -72.516, 18.240);
		seedPoint(points, "SE-JACMEL-05",    "Station Bassin-Bleu",    "KIOSK",  SE,    "Jacmel",       -72.500, 18.255);
		seedPoint(points, "SE-CAYES-01",     "Réservoir Cayes-Jacmel", "TANK",   SE,    "Cayes-Jacmel", -72.390, 18.210);
		seedPoint(points, "SE-BAINET-01",    "Borne Bainet",           "KIOSK",  SE,    "Bainet",       -72.750, 18.180);
		seedPoint(points, "SE-BELLEANSE-01", "Source Belle-Anse",      "SOURCE", SE,    "Belle-Anse",   -72.050, 18.230);
		seedPoint(points, "SE-LAVALLEE-01",  "Forage La Vallée",       "SOURCE", SE,    "La Vallée",    -72.470, 18.300);
		seedPoint(points, "SE-COTES-01",     "Réservoir Côtes-de-Fer", "TANK",   SE,    "Côtes-de-Fer", -73.000, 18.150);
		// Miette de voisin : un point dans le Sud → un acteur Sud-Est ne doit JAMAIS le voir.
		seedPoint(points, "SUD-CAYES-01",    "Forage Les Cayes",       "SOURCE", "Sud", "Les Cayes",    -73.750, 18.200);

		Instant now = Instant.now();

		// Mesure récente sur SE-JACMEL-04 (sans franchir de seuil) → capteur « OK » côté module capteurs.
		measurements.save(new com.example.api_metier.domain.MeasurementEntity(
				"SE-JACMEL-04", "PRS-20", "PRESSURE", 3.0, "bar", now.minus(8, ChronoUnit.MINUTES)));

		// 2) Alertes rattachées aux points. Dept dérivé via point.territory ; commune dénormalisée
		// sur l'alerte (dernier argument) = périmètre fin du TEPAC, filtrable sans jointure.
		// À traiter (ACTIVE)
		alerts.save(new AlertEntity("SE-MARIGOT-01", "TURB-01", "PRESSURE", AlertSeverity.CRIT, AlertStatus.ACTIVE,
				"Turbidité critique — eau impropre", now.minus(2, ChronoUnit.HOURS), now.minus(2, ChronoUnit.HOURS), "Marigot"));
		alerts.save(new AlertEntity("SE-THIOTTE-01", "PRS-01", "PRESSURE", AlertSeverity.CRIT, AlertStatus.ACTIVE,
				"Pression nulle — service interrompu", now.minus(3, ChronoUnit.HOURS), now.minus(3, ChronoUnit.HOURS), "Thiotte"));
		alerts.save(new AlertEntity("SE-JACMEL-01", "LVL-01", "LEVEL", AlertSeverity.WARN, AlertStatus.ACTIVE,
				"Niveau réservoir bas", now.minus(5, ChronoUnit.HOURS), now.minus(5, ChronoUnit.HOURS), "Jacmel"));
		// Jacmel — file du TEPAC (reproduit le wireframe terrain : réservoir critique + débit anormal)
		alerts.save(new AlertEntity("SE-JACMEL-02", "LVL-10", "LEVEL", AlertSeverity.CRIT, AlertStatus.ACTIVE,
				"Niveau de réservoir critique", now.minus(12, ChronoUnit.MINUTES), now.minus(12, ChronoUnit.MINUTES), "Jacmel"));
		alerts.save(new AlertEntity("SE-JACMEL-03", "FLW-10", "FLOW", AlertSeverity.WARN, AlertStatus.ACTIVE,
				"Débit anormal au captage", now.minus(1, ChronoUnit.HOURS), now.minus(1, ChronoUnit.HOURS), "Jacmel"));
		// En cours (ACK)
		alerts.save(new AlertEntity("SE-CAYES-01", "PRS-02", "PRESSURE", AlertSeverity.WARN, AlertStatus.ACK,
				"Pression basse — modérée", now.minus(6, ChronoUnit.HOURS), now.minus(4, ChronoUnit.HOURS), "Cayes-Jacmel"));
		alerts.save(new AlertEntity("SE-BAINET-01", "FLW-01", "FLOW", AlertSeverity.WARN, AlertStatus.ACK,
				"Fuite signalée par le TEPAC", now.minus(8, ChronoUnit.HOURS), now.minus(3, ChronoUnit.HOURS), "Bainet"));
		// Traitées (CLOSED)
		alerts.save(new AlertEntity("SE-BELLEANSE-01", "PRS-03", "PRESSURE", AlertSeverity.WARN, AlertStatus.CLOSED,
				"Pression rétablie", now.minus(48, ChronoUnit.HOURS), now.minus(20, ChronoUnit.HOURS), "Belle-Anse"));
		alerts.save(new AlertEntity("SE-LAVALLEE-01", "LVL-02", "LEVEL", AlertSeverity.INFO, AlertStatus.CLOSED,
				"Niveau revenu à la normale", now.minus(72, ChronoUnit.HOURS), now.minus(30, ChronoUnit.HOURS), "La Vallée"));
		alerts.save(new AlertEntity("SE-COTES-01", "FLW-02", "FLOW", AlertSeverity.WARN, AlertStatus.CLOSED,
				"Débit rétabli", now.minus(90, ChronoUnit.HOURS), now.minus(40, ChronoUnit.HOURS), "Côtes-de-Fer"));
		// Voisin (Sud) — hors périmètre Sud-Est.
		alerts.save(new AlertEntity("SUD-CAYES-01", "PRS-09", "PRESSURE", AlertSeverity.CRIT, AlertStatus.ACTIVE,
				"Pression critique Les Cayes", now.minus(1, ChronoUnit.HOURS), now.minus(1, ChronoUnit.HOURS), "Les Cayes"));

		// 2bis) Interventions (tickets) Jacmel — commune dénormalisée + titre, pour la file du TEPAC.
		com.example.api_metier.domain.TicketEntity t1 = new com.example.api_metier.domain.TicketEntity(
				com.example.api_metier.domain.TicketStatus.IN_PROGRESS, null, "SE-JACMEL-02", "LVL-10",
				"jeanpierre", now.minus(2, ChronoUnit.HOURS), now.minus(30, ChronoUnit.MINUTES), "Jacmel");
		t1.setTitre("Réparation conduite");
		tickets.save(t1);
		com.example.api_metier.domain.TicketEntity t2 = new com.example.api_metier.domain.TicketEntity(
				com.example.api_metier.domain.TicketStatus.ASSIGNED, null, "SE-JACMEL-03", "FLW-10",
				"jeanpierre", now.minus(1, ChronoUnit.HOURS), now.minus(1, ChronoUnit.HOURS), "Jacmel");
		t2.setTitre("Inspection captage");
		tickets.save(t2);

		// 3) Acteurs — departementId est un champ propre du modèle (pas de dérivation ici).
		acteurs.save(new ActeurEntity("SE-ACT-01", ActeurType.OPERATEUR, "Régie communale de Jacmel", SE,
				"Jacmel", "regie", "Mairie de Jacmel", "convention", 2023, 2028, null, null, null, "+509 3700 0001", "actif", "seed"));
		acteurs.save(new ActeurEntity("SE-ACT-02", ActeurType.TEPAC, "TEPAC Marigot", SE,
				"Marigot", null, null, null, null, null, null, null, "Responsable Marigot", "+509 3700 0002", "actif", "seed"));
		acteurs.save(new ActeurEntity("SE-ACT-03", ActeurType.MAIRIE, "Mairie de Cayes-Jacmel", SE,
				"Cayes-Jacmel", null, null, null, null, null, null, null, "Maire de Cayes-Jacmel", "+509 3700 0003", "actif", "seed"));
		// Voisin
		acteurs.save(new ActeurEntity("SUD-ACT-01", ActeurType.OPERATEUR, "Régie des Cayes", "Sud",
				"Les Cayes", "regie", "Mairie des Cayes", "convention", 2022, 2027, null, null, null, "+509 3700 0009", "actif", "seed"));

		// 4) Ressources naturelles — rattachement département via la liaison N–N.
		seedRessource(ressources, ressourceDepts, "SE-RES-01", "SE-SRC-01", "Source de Jacmel",
				RessourceType.SOURCE, RessourceEtat.SAINE, 120.0, 18.234, -72.534, "Jacmel", SE);
		seedRessource(ressources, ressourceDepts, "SE-RES-02", "SE-RIV-01", "Rivière Gauche",
				RessourceType.RIVIERE, RessourceEtat.MENACEE, 800.0, 18.210, -72.390, "Cayes-Jacmel", SE);
		// Voisin
		seedRessource(ressources, ressourceDepts, "SUD-RES-01", "SUD-SRC-01", "Source des Cayes",
				RessourceType.SOURCE, RessourceEtat.SAINE, 150.0, 18.200, -73.750, "Les Cayes", "Sud");

		// Ouest / Carrefour — démo du cycle de recensement TEPAC → validation superviseur.
		// Une ressource officielle (VALIDEE) + un recensement EN ATTENTE (file de validation de l'URD Ouest,
		// visible par le TEPAC de Carrefour comme « en attente »).
		seedRessourceStatut(ressources, ressourceDepts, "OU-RES-01", "OU-SRC-01", "Source Thor",
				RessourceType.SOURCE, RessourceEtat.SAINE, 25.0, 18.5402, -72.4051, "Carrefour", "Ouest",
				RessourceStatut.VALIDEE, "seed");
		seedRessourceStatut(ressources, ressourceDepts, "OU-RES-02", "OU-SRC-02", "Source Nan Roch",
				RessourceType.SOURCE, RessourceEtat.MENACEE, 18.0, 18.5351, -72.3987, "Carrefour", "Ouest",
				RessourceStatut.EN_ATTENTE_VALIDATION, "tcarrefour");
	}

	/**
	 * Zones AEP Sud-Est (3 actives + 1 à déployer) + 1 voisin Sud (Kelly ne doit pas la voir).
	 * Idempotent (marqueur Z-SE-JACMEL). departementId = champ de périmètre (dérivé commune→dept).
	 */
	private void seedZonesSudEst(ZoneRepository zones) {
		if (zones.findById("Z-SE-JACMEL").isPresent()) {
			return;
		}
		final String SE = "Sud-Est";
		Instant now = Instant.now();
		zones.save(new ZoneEntity("Z-SE-JACMEL",  "Z-SE-01", "Réseau Jacmel-centre", "Jacmel",       SE, null, ZoneStatus.ACTIVE,     38000, "seed", now));
		zones.save(new ZoneEntity("Z-SE-CAYESJ",  "Z-SE-02", "Zone Cayes-Jacmel",    "Cayes-Jacmel", SE, null, ZoneStatus.ACTIVE,     21000, "seed", now));
		zones.save(new ZoneEntity("Z-SE-MARIGOT", "Z-SE-03", "Zone Marigot",         "Marigot",      SE, null, ZoneStatus.ACTIVE,     17000, "seed", now));
		zones.save(new ZoneEntity("Z-SE-BAINET",  "Z-SE-04", "Zone Bainet",          "Bainet",       SE, null, ZoneStatus.A_DEPLOYER, 24000, null,   null));
		// Voisin (Sud) — hors périmètre de Kelly.
		zones.save(new ZoneEntity("Z-SUD-CAYES",  "Z-SUD-01", "Zone Les Cayes",      "Les Cayes",    "Sud", null, ZoneStatus.ACTIVE,  30000, "seed", now));
	}

	private void seedRessource(RessourceRepository ressources, RessourceDepartementRepository ressourceDepts,
			String id, String code, String nom, RessourceType type, RessourceEtat etat,
			Double debitM3h, Double lat, Double lon, String commune, String departementId) {
		ressources.save(new RessourceEntity(id, code, nom, type, etat, debitM3h, lat, lon, commune, null, "seed"));
		ressourceDepts.save(new RessourceDepartementEntity(id, departementId, true, 1.0));
	}

	/**
	 * Capteurs IoT démo. Idempotent (marqueur CPT-PR-CAR-001). Jacmel (Sud-Est) pour ne pas régresser
	 * la vue du TEPAC Jean Pierre ; Carrefour (Ouest) pour le cycle déclaration → validation
	 * (2 validés avec mesure live + 1 EN ATTENTE déclaré par le TEPAC Carrefour).
	 */
	private void seedCapteurs(com.example.api_metier.repo.CapteurRepository capteurs) {
		if (capteurs.findById("CPT-PR-CAR-001").isPresent()) {
			return;
		}
		java.time.Instant now = java.time.Instant.now();
		// Carrefour / Ouest — validés, avec dernière mesure (s'afficheront « en ligne » au démarrage).
		seedCapteur(capteurs, "CPT-PR-CAR-001", "Capteur pression Forage F-21",
				com.example.api_metier.domain.CapteurType.PRESSION, "Ouest", "Carrefour",
				"OUV-CARR-01", "Forage Carrefour Nord F-21", "ESP32-CAR-F21",
				"gestidlo/ouest/carrefour/forage-f21/pression", "bar", 18.5421, -72.3995,
				0.6, 82, -61, now, com.example.api_metier.domain.CapteurValidation.VALIDEE, "seed");
		seedCapteur(capteurs, "CPT-NV-CAR-002", "Capteur niveau Réservoir R-01",
				com.example.api_metier.domain.CapteurType.NIVEAU, "Ouest", "Carrefour",
				"OUV-CARR-02", "Réservoir Carrefour R-01", "ESP32-CAR-R01",
				"gestidlo/ouest/carrefour/reservoir-r01/niveau", "%", 18.5388, -72.4042,
				72.0, 85, -58, now, com.example.api_metier.domain.CapteurValidation.VALIDEE, "seed");
		// Déclaration EN ATTENTE par le TEPAC Carrefour (file de validation de l'URD Ouest).
		seedCapteur(capteurs, "CPT-DB-CAR-003", "Capteur débit conduite C-127",
				com.example.api_metier.domain.CapteurType.DEBIT, "Ouest", "Carrefour",
				null, "Conduite C-127", "ESP32-CAR-C127",
				"gestidlo/ouest/carrefour/conduite-c127/debit", "L/min", 18.5360, -72.4015,
				null, null, null, null, com.example.api_metier.domain.CapteurValidation.EN_ATTENTE_VALIDATION, "tcarrefour");
		// Jacmel / Sud-Est — validé (vue du TEPAC Jean Pierre).
		seedCapteur(capteurs, "CPT-NV-JAC-001", "Capteur niveau Réservoir Jacmel",
				com.example.api_metier.domain.CapteurType.NIVEAU, "Sud-Est", "Jacmel",
				null, "Réservoir Jacmel R02", "ESP32-JAC-R02",
				"gestidlo/sud-est/jacmel/reservoir-r02/niveau", "%", 18.235, -72.523,
				21.0, 70, -67, now, com.example.api_metier.domain.CapteurValidation.VALIDEE, "seed");
	}

	private void seedCapteur(com.example.api_metier.repo.CapteurRepository capteurs,
			String code, String nom, com.example.api_metier.domain.CapteurType type,
			String dept, String commune, String ouvrageId, String ouvrageNom, String deviceId,
			String mqttTopic, String unit, Double lat, Double lon,
			Double lastValue, Integer battery, Integer signal, java.time.Instant lastSeen,
			com.example.api_metier.domain.CapteurValidation statut, String createdBy) {
		com.example.api_metier.domain.CapteurEntity c = new com.example.api_metier.domain.CapteurEntity(
				code, code, nom, type, dept, commune, ouvrageId, ouvrageNom, deviceId, mqttTopic, unit, lat, lon, createdBy);
		c.setStatut(statut);
		if (lastValue != null) c.onMeasure(lastValue, unit, battery, signal, lastSeen);
		capteurs.save(c);
	}

	/** Variante avec statut de validation explicite (pour démontrer le cycle recensement → validation). */
	private void seedRessourceStatut(RessourceRepository ressources, RessourceDepartementRepository ressourceDepts,
			String id, String code, String nom, RessourceType type, RessourceEtat etat,
			Double debitM3h, Double lat, Double lon, String commune, String departementId,
			RessourceStatut statut, String createdBy) {
		RessourceEntity e = new RessourceEntity(id, code, nom, type, etat, debitM3h, lat, lon, commune, null, createdBy);
		e.setStatut(statut);
		ressources.save(e);
		ressourceDepts.save(new RessourceDepartementEntity(id, departementId, true, 1.0));
	}

	/**
	 * Ouvrages démo Ouest / Carrefour — patrimoine bâti backend (cycle recensement → validation).
	 * Idempotent (marqueur OUV-CARR-01). 2 officiels (VALIDEE) + 1 soumission EN ATTENTE par le
	 * TEPAC Carrefour (file de validation de l'URD Ouest / Doune Deri).
	 */
	private void seedOuvragesOuest(com.example.api_metier.repo.OuvrageRepository ouvrages) {
		if (ouvrages.findById("OUV-CARR-01").isPresent()) {
			return;
		}
		final String OUEST = "Ouest", CARR = "Carrefour";
		ouvrages.save(new com.example.api_metier.domain.OuvrageEntity(
				"OUV-CARR-01", "F-CAR-21", "Forage Carrefour Nord F-21",
				com.example.api_metier.domain.OuvrageType.FORAGE, com.example.api_metier.domain.OuvrageEtat.OPERATIONNEL,
				OUEST, CARR, "Section 2", "Bizoton", 18.5421, -72.3995, 32.0, 2018,
				null, null, null, "seed"));
		ouvrages.save(new com.example.api_metier.domain.OuvrageEntity(
				"OUV-CARR-02", "TANK-CAR-R01", "Réservoir Carrefour R-01",
				com.example.api_metier.domain.OuvrageType.RESERVOIR, com.example.api_metier.domain.OuvrageEtat.OPERATIONNEL,
				OUEST, CARR, "Section 1", "Thor", 18.5388, -72.4042, 100.0, 2015,
				null, null, null, "seed"));
		// Soumission EN ATTENTE : recensée par le TEPAC Carrefour, à valider par le superviseur Ouest.
		com.example.api_metier.domain.OuvrageEntity attente = new com.example.api_metier.domain.OuvrageEntity(
				"OUV-CARR-03", "TANK-CAR-R02", "Réservoir Thor R-02",
				com.example.api_metier.domain.OuvrageType.RESERVOIR, com.example.api_metier.domain.OuvrageEtat.OPERATIONNEL,
				OUEST, CARR, "Section 1", "Thor", 18.5365, -72.4010, 80.0, 2024,
				null, null, "Recensé sur le terrain — capacité estimée", "tcarrefour");
		attente.setStatut(com.example.api_metier.domain.OuvrageValidation.EN_ATTENTE_VALIDATION);
		ouvrages.save(attente);
	}

	/**
	 * Rapports Sud-Est par état (inbox de validation vérifiable). Le « à valider » = TRANSMIS.
	 * Comme pour les alertes : une miette de voisin (Sud, TRANSMIS) + un rapport NATIONAL
	 * (Exécutif) pour prouver que Kelly ne voit ni l'autre URD ni le national. Idempotent.
	 * Attendu pour Kelly : à valider 2 · brouillon 1 · validés 8 · archivés 5 · tous 16.
	 */
	private void seedRapportsSudEst(RapportRepository rapports) {
		if (rapports.findById("SE-RAP-T1").isPresent()) {
			return;
		}
		final String SE = "Sud-Est";
		Instant now = Instant.now();

		// À valider (TRANSMIS) — le bucket actionnable de l'inbox.
		rapports.save(new RapportEntity("SE-RAP-T1", "Rapport mensuel — Marigot · juin 2026", "mensuel",
				RapportStatus.TRANSMIS, SE, false, "Marigot", "Jean P.", null, 12, now.minus(3, ChronoUnit.DAYS)));
		rapports.save(new RapportEntity("SE-RAP-T2", "Rapport technique — Source Bainet", "technique",
				RapportStatus.TRANSMIS, SE, false, "Bainet", "Maria C.", null, 6, now.minus(1, ChronoUnit.DAYS)));
		// Brouillon
		rapports.save(new RapportEntity("SE-RAP-B1", "Rapport mensuel — Jacmel · juin 2026", "mensuel",
				RapportStatus.BROUILLON, SE, false, "Jacmel", "Paul T.", null, 4, null));
		// Validés (8) et Archivés (5)
		for (int i = 1; i <= 8; i++) {
			rapports.save(new RapportEntity("SE-RAP-V" + i, "Rapport mensuel — mai 2026 (#" + i + ")", "mensuel",
					RapportStatus.VALIDE, SE, false, "Jacmel", "TEPAC Sud-Est", null, 8, now.minus(20 + i, ChronoUnit.DAYS)));
		}
		for (int i = 1; i <= 5; i++) {
			rapports.save(new RapportEntity("SE-RAP-A" + i, "Rapport trimestriel — T1 2026 (#" + i + ")", "trimestriel",
					RapportStatus.ARCHIVE, SE, false, "Jacmel", "TEPAC Sud-Est", null, 16, now.minus(90 + i, ChronoUnit.DAYS)));
		}
		// Voisin (Sud) — Kelly ne doit JAMAIS le voir.
		rapports.save(new RapportEntity("SUD-RAP-T1", "Rapport mensuel — Les Cayes · juin 2026", "mensuel",
				RapportStatus.TRANSMIS, "Sud", false, "Les Cayes", "TEPAC Sud", null, 10, now.minus(2, ChronoUnit.DAYS)));
		// National (Exécutif) — niveau DINEPA, exclu de toute vue URD.
		rapports.save(new RapportEntity("NAT-RAP-1", "Rapport Exécutif national — juin 2026", "executif",
				RapportStatus.TRANSMIS, null, true, null, "DINEPA", null, 40, now.minus(5, ChronoUnit.DAYS)));
	}

	/**
	 * Station « Château d'eau Carrefour » : regroupe les 3 capteurs de Carrefour sur UN SEUL ouvrage
	 * (la vue station agrège par ouvrageId), corrige l'orphelin débit (ouvrageId null) et le valide,
	 * pour que le TEPAC Carrefour atterrisse direct sur sa station multi-métriques. Idempotent.
	 */
	/**
	 * Jacmel / Sud-Est (choix b1) : enregistre le réservoir « Réservoir Jacmel R02 » dans le
	 * registre des ouvrages, puis y rattache le capteur de niveau CPT-NV-JAC-001 qui pointait
	 * jusque-là dans le vide (ouvrageId null). Idempotent : ne récrée rien si déjà présent.
	 */
	private void seedReservoirJacmel(com.example.api_metier.repo.OuvrageRepository ouvrages,
			com.example.api_metier.repo.CapteurRepository capteurs) {
		final String ID = "OUV-JAC-R02", NOM = "Réservoir Jacmel R02";
		if (ouvrages.findById(ID).isEmpty()) {
			ouvrages.save(new com.example.api_metier.domain.OuvrageEntity(
					ID, "TANK-JAC-R02", NOM,
					com.example.api_metier.domain.OuvrageType.RESERVOIR,
					com.example.api_metier.domain.OuvrageEtat.OPERATIONNEL,
					"Sud-Est", "Jacmel", "1ère section Jacmel", "Bas de Jacmel", 18.235, -72.523, 60.0, 2019,
					null, null, null, "seed"));
		}
		capteurs.findByCodeIgnoreCase("CPT-NV-JAC-001").ifPresent(c -> {
			if (!ID.equals(c.getOuvrageId())) {
				c.setOuvrage(ID, NOM);
				capteurs.save(c);
			}
		});
	}

	/**
	 * Station démo Delmas (Ouest) — donne au TEPAC de Delmas EXACTEMENT le même parcours que
	 * Carrefour : un ouvrage validé + 3 capteurs en ligne. Avec un seul ouvrage en périmètre,
	 * l'atterrissage conscient du périmètre (SupCapteursPageComponent) redirige direct sur la
	 * station live — plus de page « 0 capteur ». Idempotent (marqueur OUV-DELM-01).
	 */
	private void seedStationDelmas(com.example.api_metier.repo.OuvrageRepository ouvrages,
			com.example.api_metier.repo.CapteurRepository capteurs) {
		final String ID = "OUV-DELM-01", NOM = "Réservoir Delmas 33";
		if (ouvrages.findById(ID).isPresent()) {
			return;
		}
		ouvrages.save(new com.example.api_metier.domain.OuvrageEntity(
				ID, "TANK-DLM-33", NOM,
				com.example.api_metier.domain.OuvrageType.RESERVOIR,
				com.example.api_metier.domain.OuvrageEtat.OPERATIONNEL,
				"Ouest", "Delmas", "Delmas 33", "Delmas", 18.5445, -72.3028, 80.0, 2021,
				null, null, null, "seed"));
		java.time.Instant now = java.time.Instant.now();
		seedCapteur(capteurs, "CPT-NV-DLM-001", "Capteur niveau Réservoir Delmas 33",
				com.example.api_metier.domain.CapteurType.NIVEAU, "Ouest", "Delmas",
				ID, NOM, "ESP32-DLM-R33",
				"gestidlo/ouest/delmas/reservoir-d33/niveau", "%", 18.5445, -72.3028,
				68.0, 88, -59, now, com.example.api_metier.domain.CapteurValidation.VALIDEE, "seed");
		seedCapteur(capteurs, "CPT-PR-DLM-002", "Capteur pression conduite Delmas 33",
				com.example.api_metier.domain.CapteurType.PRESSION, "Ouest", "Delmas",
				ID, NOM, "ESP32-DLM-PR",
				"gestidlo/ouest/delmas/reservoir-d33/pression", "bar", 18.5448, -72.3031,
				2.0, 84, -62, now, com.example.api_metier.domain.CapteurValidation.VALIDEE, "seed");
		seedCapteur(capteurs, "CPT-DB-DLM-003", "Capteur débit conduite Delmas 33",
				com.example.api_metier.domain.CapteurType.DEBIT, "Ouest", "Delmas",
				ID, NOM, "ESP32-DLM-DB",
				"gestidlo/ouest/delmas/reservoir-d33/debit", "L/min", 18.5442, -72.3025,
				11.5, 86, -60, now, com.example.api_metier.domain.CapteurValidation.VALIDEE, "seed");
	}

	private void aligneStationCarrefour(com.example.api_metier.repo.CapteurRepository capteurs) {
		final String OUV = "OUV-CARR-01";
		final String NOM = "Château d'eau Carrefour";
		for (String code : List.of("CPT-PR-CAR-001", "CPT-NV-CAR-002", "CPT-DB-CAR-003")) {
			capteurs.findByCodeIgnoreCase(code).ifPresent(c -> {
				boolean change = false;
				if (!OUV.equals(c.getOuvrageId()) || !NOM.equals(c.getOuvrageNom())) {
					c.setOuvrage(OUV, NOM);
					change = true;
				}
				if (c.getStatut() != com.example.api_metier.domain.CapteurValidation.VALIDEE) {
					c.valider("seed", Instant.now());
					change = true;
				}
				if (change) capteurs.save(c);
			});
		}
	}

	/**
	 * Nettoyage one-shot : retire les alertes/tickets de démonstration intitulés « Test alerte »
	 * (créés lors de validations manuelles). Idempotent : no-op une fois la donnée absente.
	 * Tickets d'abord (ils référencent l'alerte), puis alertes.
	 */
	private void purgeTestData(AlertRepository alerts,
			com.example.api_metier.repo.TicketRepository tickets) {
		tickets.findAll().stream()
				.filter(t -> "Test alerte".equals(t.getTitre()))
				.forEach(tickets::delete);
		alerts.findAll().stream()
				.filter(a -> "Test alerte".equals(a.getMessage()))
				.forEach(alerts::delete);
	}

	/**
	 * Circuit terrain de l'URD Ouest (commune Carrefour) : déroule TOUT le parcours
	 * technicien → superviseur signataire → admin, un rapport par état, pour que chaque écran
	 * ait de la donnée dès le premier render et que la démo se déroule sans rien créer à la main.
	 *
	 * <ul>
	 *   <li>Auteur terrain : {@code tcarrefour} (« TEPAC Carrefour », commune Carrefour, dept Ouest).</li>
	 *   <li>Superviseur signataire : {@code doune} (« Doune Deri », URD-OUEST).</li>
	 * </ul>
	 *
	 * Le {@code resumeAuto} est généré par le MÊME service que l'endpoint live : le texte seedé
	 * est donc identique à ce que produira une vraie soumission.
	 */
	private void seedRapportsTerrainOuest(RapportRepository rapports,
			com.example.api_metier.service.RapportRedactionService redaction) {
		if (rapports.findById("OU-RAP-INT").isPresent()) {
			return;
		}
		final String OUEST = "Ouest";
		final String CARR  = "Carrefour";
		final String AUTEUR = "TEPAC Carrefour";
		final String AUTEUR_U = "tcarrefour";
		Instant now = Instant.now();

		// 1) EN_ATTENTE (TRANSMIS) — l'inbox « à valider » de Doune a quelque chose en live.
		String cInt = "{\"etat_general\":\"Critique\","
				+ "\"activites\":[\"Inspection infrastructure\",\"Vérification capteur IoT\"],"
				+ "\"problemes_observes\":[\"Pompe en panne\",\"Faible pression\"],"
				+ "\"infrastructure\":\"Forage Carrefour F-08\","
				+ "\"observation_courte\":\"Pompe HS au forage F-08, ne démarre pas\","
				+ "\"gps\":{\"latitude\":18.5411,\"longitude\":-72.3992}}";
		RapportEntity r1 = new RapportEntity("OU-RAP-INT", "Rapport d'intervention — Forage Carrefour F-08",
				"intervention", RapportStatus.TRANSMIS, OUEST, false, CARR, AUTEUR, AUTEUR_U, 2,
				now.minus(6, ChronoUnit.HOURS));
		r1.setContenuJson(cInt);
		r1.setResumeAuto(redaction.generer("intervention", CARR, cInt));
		rapports.save(r1);

		// 2) À_CORRIGER (BROUILLON + motif) — montre la boucle de rejet/correction.
		String cCor = "{\"etat_general\":\"Perturbé\","
				+ "\"activites\":[\"Visite de terrain\"],"
				+ "\"problemes_observes\":[\"Faible pression\"],"
				+ "\"observation_courte\":\"Pression faible secteur sud\"}";
		RapportEntity r2 = new RapportEntity("OU-RAP-COR", "Rapport journalier — Carrefour",
				"journalier", RapportStatus.BROUILLON, OUEST, false, CARR, AUTEUR, AUTEUR_U, 1, null);
		r2.setContenuJson(cCor);
		r2.setResumeAuto(redaction.generer("journalier", CARR, cCor));
		r2.setMotifRenvoi("Préciser l'heure du constat et joindre une photo du point de mesure.");
		rapports.save(r2);

		// 3) VALIDÉ_SUPERVISEUR (VALIDE) — validé par Doune, en attente de signature/transmission.
		String cIot = "{\"etat_general\":\"Perturbé\","
				+ "\"activites\":[\"Vérification capteur IoT\",\"Relevé de données\"],"
				+ "\"problemes_observes\":[\"Capteur hors ligne\"],"
				+ "\"infrastructure\":\"Capteur pression CPT-PR-CAR-001\","
				+ "\"observation_courte\":\"Capteur de pression hors ligne depuis 2 jours\","
				+ "\"gps\":{\"latitude\":18.5390,\"longitude\":-72.3950}}";
		RapportEntity r3 = new RapportEntity("OU-RAP-IOT", "Rapport IoT — capteur pression Carrefour",
				"iot", RapportStatus.TRANSMIS, OUEST, false, CARR, AUTEUR, AUTEUR_U, 1,
				now.minus(2, ChronoUnit.DAYS));
		r3.setContenuJson(cIot);
		r3.setResumeAuto(redaction.generer("iot", CARR, cIot));
		r3.valider("doune", now.minus(1, ChronoUnit.DAYS));
		rapports.save(r3);

		// 4) TRANSMIS_ADMIN — signé par Doune et remonté à l'admin : alimente la liste officielle.
		String cInf = "{\"etat_general\":\"Normal\","
				+ "\"activites\":[\"Visite de terrain\",\"Inspection infrastructure\"],"
				+ "\"problemes_observes\":[\"Aucun problème majeur\"],"
				+ "\"infrastructure\":\"Réservoir Carrefour R-02\","
				+ "\"observation_courte\":\"Réservoir en bon état, niveau correct\","
				+ "\"gps\":{\"latitude\":18.5360,\"longitude\":-72.4010}}";
		RapportEntity r4 = new RapportEntity("OU-RAP-ADM", "Rapport infrastructure — Réservoir Carrefour R-02",
				"infrastructure", RapportStatus.TRANSMIS, OUEST, false, CARR, AUTEUR, AUTEUR_U, 2,
				now.minus(4, ChronoUnit.DAYS));
		r4.setContenuJson(cInf);
		r4.setResumeAuto(redaction.generer("infrastructure", CARR, cInf));
		r4.valider("doune", now.minus(3, ChronoUnit.DAYS));
		r4.signerEtTransmettre("doune", "Doune Deri", now.minus(3, ChronoUnit.DAYS));
		rapports.save(r4);

		// 5) BROUILLON technicien (sans motif) — montre l'auto-save avant soumission.
		String cBr = "{\"activites\":[\"Visite de terrain\"]}";
		RapportEntity r5 = new RapportEntity("OU-RAP-BR", "Rapport journalier — Carrefour (brouillon)",
				"journalier", RapportStatus.BROUILLON, OUEST, false, CARR, AUTEUR, AUTEUR_U, 1, null);
		r5.setContenuJson(cBr);
		r5.setResumeAuto(redaction.generer("journalier", CARR, cBr));
		rapports.save(r5);
	}

}
