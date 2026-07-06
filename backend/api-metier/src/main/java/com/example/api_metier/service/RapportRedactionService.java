package com.example.api_metier.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Transforme les choix guidés du technicien (cases cochées + observation courte, sérialisés en
 * JSON) en un texte professionnel prêt à valider. <b>Déterministe et hors-ligne</b> : pas de LLM,
 * juste des gabarits par type de rapport. C'est exactement le « le technicien clique, le système
 * rédige » de la spec — fiable, démontrable sans réseau, et brancher Claude plus tard reste possible
 * en remplaçant cette seule classe.
 *
 * <p>Forme attendue de {@code contenuJson} (tous les champs sont optionnels) :
 * <pre>{@code
 * {
 *   "etat_general": "Perturbé",
 *   "activites": ["Inspection infrastructure", "Vérification capteur IoT"],
 *   "problemes_observes": ["Pompe en panne", "Faible pression"],
 *   "infrastructure": "Forage Carrefour F-08",
 *   "observation_courte": "Pompe HS au forage F-08",
 *   "gps": { "latitude": 18.5411, "longitude": -72.3992 }
 * }
 * }</pre>
 */
@Service
public class RapportRedactionService {

	private final ObjectMapper mapper = new ObjectMapper();

	/**
	 * Génère le texte du rapport à partir du type et du contenu guidé. Tolère un JSON null/vide
	 * (retourne alors une phrase minimale) et tout champ manquant.
	 *
	 * @param type    type de rapport (journalier, intervention, incident, infrastructure, ressource, iot…)
	 * @param commune commune d'affectation (verrouillée côté token), pour situer le rapport
	 * @param contenuJson choix guidés sérialisés, ou {@code null}
	 * @return un paragraphe professionnel en français
	 */
	public String generer(String type, String commune, String contenuJson) {
		JsonNode c = parse(contenuJson);
		String lieu = blankOr(commune, "la zone d'affectation");
		String ouvrage = text(c, "infrastructure");
		List<String> activites = list(c, "activites");
		List<String> problemes = list(c, "problemes_observes");
		String etat = text(c, "etat_general");
		String obs = text(c, "observation_courte");

		StringBuilder sb = new StringBuilder();
		String t = (type == null) ? "" : type.toLowerCase();

		// Phrase d'ouverture selon le type.
		switch (t) {
			case "intervention" -> sb.append("Une intervention terrain a été menée dans la commune de ")
					.append(lieu);
			case "incident" -> sb.append("Un incident a été constaté dans la commune de ").append(lieu);
			case "infrastructure" -> sb.append("Un point sur l'état des infrastructures a été effectué dans la commune de ")
					.append(lieu);
			case "ressource" -> sb.append("Un recensement de ressource a été réalisé dans la commune de ").append(lieu);
			case "iot" -> sb.append("Un relevé des capteurs IoT a été réalisé dans la commune de ").append(lieu);
			default -> sb.append("Au cours de la journée, une visite de terrain a été réalisée dans la commune de ")
					.append(lieu);
		}
		if (!ouvrage.isBlank()) {
			sb.append(", principalement au niveau de ").append(ouvrage);
		}
		sb.append(". ");

		// Activités réalisées.
		if (!activites.isEmpty()) {
			sb.append("L'équipe terrain a procédé à ").append(enumerer(activites, true)).append(". ");
		}

		// Problèmes observés (ou absence).
		if (!problemes.isEmpty()) {
			sb.append("Les constats suivants ont été relevés : ").append(enumerer(problemes, false)).append(". ");
		} else {
			sb.append("Aucun problème majeur n'a été signalé lors de cette visite. ");
		}

		// État général explicite.
		if (!etat.isBlank()) {
			sb.append("L'état général du réseau est qualifié de « ").append(etat.toLowerCase()).append(" ». ");
		}

		// Observation libre du technicien, reprise telle quelle (le terrain a le dernier mot).
		if (!obs.isBlank()) {
			sb.append(capitaliser(obs));
			if (!obs.endsWith(".")) sb.append(".");
			sb.append(' ');
		}

		// ── Pilier 2 : contexte temporel (heures, durée, mission, conditions) ───
		String heureDebut = text(c, "heure_debut");
		String heureFin   = text(c, "heure_fin");
		String duree      = text(c, "duree");
		String mission    = text(c, "contexte_mission");
		List<String> conditions = list(c, "conditions");
		if (!heureDebut.isBlank() && !heureFin.isBlank()) {
			sb.append("L'intervention s'est déroulée de ").append(heureDebut).append(" à ").append(heureFin);
			if (!duree.isBlank()) sb.append(" (durée ").append(duree).append(")");
			sb.append(". ");
		}
		if (!mission.isBlank()) {
			sb.append("Contexte de la mission : ").append(mission.toLowerCase()).append(". ");
		}
		if (!conditions.isEmpty()) {
			sb.append("Conditions de terrain : ").append(enumerer(conditions, true)).append(". ");
		}

		// ── Pilier 3 : impact, population, cause probable ──────────────────────
		String impact     = text(c, "impact");
		String population  = text(c, "population_impactee");
		String cause       = text(c, "cause_probable");
		if (!impact.isBlank() || !population.isBlank()) {
			sb.append("L'impact est estimé ").append(impact.isBlank() ? "à évaluer" : impact.toLowerCase());
			if (!population.isBlank()) sb.append(", touchant environ ").append(population).append(" ménages");
			sb.append(". ");
		}
		if (!cause.isBlank()) {
			sb.append("Cause probable : ").append(cause);
			if (!cause.endsWith(".")) sb.append(".");
			sb.append(' ');
		}

		// ── Pilier 4 : opérations (tests, résultat) ────────────────────────────
		List<String> tests = list(c, "tests");
		String resultat    = text(c, "resultat_final");
		if (!tests.isEmpty()) {
			sb.append("Tests effectués : ").append(enumerer(tests, true)).append(". ");
		}
		if (!resultat.isBlank()) {
			sb.append("Résultat de l'intervention : ").append(resultat.toLowerCase()).append(". ");
		}

		// ── Pilier 5 : matériaux et ressources ─────────────────────────────────
		JsonNode mat = (c == null) ? null : c.get("materiaux");
		boolean aucunMat = mat != null && mat.path("aucun").asBoolean(false);
		List<String> pieces       = list(mat, "pieces");
		List<String> consommables = list(mat, "consommables");
		List<String> outils       = list(mat, "outils");
		if (aucunMat) {
			sb.append("Aucun matériel spécifique n'a été consommé. ");
		} else {
			List<String> mats = new ArrayList<>();
			mats.addAll(pieces);
			mats.addAll(consommables);
			if (!mats.isEmpty()) sb.append("Matériel utilisé : ").append(enumerer(mats, true)).append(". ");
			if (!outils.isEmpty()) sb.append("Outils mobilisés : ").append(enumerer(outils, true)).append(". ");
		}

		// ── Pilier 6 : recommandation, suivi, prochaine action ─────────────────
		String reco       = text(c, "recommandation");
		boolean suivi     = c != null && c.path("suivi_necessaire").asBoolean(false);
		String prochaine  = text(c, "prochaine_action");
		String priorite   = text(c, "priorite");
		if (!reco.isBlank()) {
			sb.append("Recommandation : ").append(reco);
			if (!reco.endsWith(".")) sb.append(".");
			sb.append(' ');
		}
		if (suivi) {
			sb.append("Un suivi complémentaire est requis");
			if (!priorite.isBlank()) sb.append(" (priorité ").append(priorite.toLowerCase()).append(")");
			sb.append(". ");
		}
		if (!prochaine.isBlank()) {
			sb.append("Prochaine action proposée : ").append(prochaine);
			if (!prochaine.endsWith(".")) sb.append(".");
			sb.append(' ');
		}

		// Recommandation si l'état/les problèmes sont critiques.
		boolean critique = etat.toLowerCase().contains("critique")
				|| problemes.stream().anyMatch(p -> {
					String pl = p.toLowerCase();
					return pl.contains("panne") || pl.contains("hors") || pl.contains("fuite");
				});
		if (critique) {
			sb.append("Une intervention technique est recommandée pour rétablir le fonctionnement normal de l'ouvrage.");
		}

		return sb.toString().trim();
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	private JsonNode parse(String json) {
		if (json == null || json.isBlank()) return null;
		try {
			return mapper.readTree(json);
		} catch (Exception e) {
			return null; // contenu mal formé : on dégrade en phrase minimale, jamais d'échec dur
		}
	}

	private static String text(JsonNode c, String field) {
		if (c == null) return "";
		JsonNode n = c.get(field);
		return (n == null || n.isNull()) ? "" : n.asText("").trim();
	}

	private static List<String> list(JsonNode c, String field) {
		List<String> out = new ArrayList<>();
		if (c == null) return out;
		JsonNode n = c.get(field);
		if (n != null && n.isArray()) {
			for (JsonNode item : n) {
				String v = item.asText("").trim();
				if (!v.isBlank()) out.add(v);
			}
		}
		return out;
	}

	/** « a », « a et b », « a, b et c ». Si {@code minuscule}, met le premier mot en minuscule. */
	private static String enumerer(List<String> items, boolean minuscule) {
		List<String> xs = new ArrayList<>(items);
		if (minuscule && !xs.isEmpty()) {
			xs.set(0, decapitaliser(xs.get(0)));
		}
		if (xs.size() == 1) return xs.get(0);
		String last = xs.get(xs.size() - 1);
		String head = String.join(", ", xs.subList(0, xs.size() - 1));
		return head + " et " + last;
	}

	private static String capitaliser(String s) {
		return s.isBlank() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
	}

	private static String decapitaliser(String s) {
		return s.isBlank() ? s : Character.toLowerCase(s.charAt(0)) + s.substring(1);
	}

	private static String blankOr(String s, String fallback) {
		return (s == null || s.isBlank()) ? fallback : s;
	}
}
