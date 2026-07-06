package com.example.api_metier.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Attestation d'examen FIGÉE d'un rapport par un superviseur — un registre d'audit, pas un
 * champ de plus sur le rapport. Immuable, horodaté, append-only : on n'efface jamais une
 * signature, on la <b>supersède</b> (voir {@link #superseder}).
 *
 * <p>Deux identités sont gelées, et il faut comprendre pourquoi elles sont séparées :
 * <ul>
 *   <li>{@code departementId} (claim {@code dept}) = <b>la clé de scope</b>, exactement le champ
 *       que la garde {@code scoped()} compare au {@code departementId} du rapport. Vérité de
 *       périmètre.</li>
 *   <li>{@code urdId} (claim {@code urdId}) = <b>identité institutionnelle</b> pour l'affichage et
 *       l'audit (pied de page du rapport officiel). JAMAIS relu par une garde — sinon on
 *       réintroduit la double-source qu'on a éliminée.</li>
 * </ul>
 *
 * <p>{@code contentHash} = SHA-256 du {@code snapshotJson} canonique (document technicien gelé +
 * couche d'examen). C'est le tripwire : entre {@code valider()} (création du snapshot) et
 * {@code signer()} (engagement vers DINEPA), le hash est revérifié ; s'il ne recolle pas, le
 * contenu a bougé et la signature ne peut être engagée.
 *
 * <p><b>Dette assumée (dev/démo).</b> L'unicité « au plus une signature {@code ACTIVE} par
 * rapport » devrait être un index partiel {@code unique(rapportId) WHERE etat='ACTIVE'} au
 * niveau DB. Hibernate {@code ddl-auto=update} ne le génère pas de façon fiable : l'invariant
 * est donc tenu dans la transaction de {@code valider()}. Avant tout usage réel, cette table
 * passe sous migration versionnée avec la contrainte partielle écrite à la main.
 */
@Entity
@Table(name = "rapport_signature", indexes = {
		@Index(name = "ix_rapport_signature_rapport", columnList = "rapportId")
})
public class RapportSignatureEntity {

	/** Cycle de vie de la SIGNATURE (distinct du cycle du rapport). */
	public enum Etat { ACTIVE, SUPERSEDEE }

	@Id
	@Column(nullable = false, length = 50)
	private String id;

	@Column(nullable = false, length = 50)
	private String rapportId;

	// ── Identité FIGÉE du signataire (au moment de la signature) ──────────────
	@Column(nullable = false, length = 80)
	private String signataireUsername;

	@Column(length = 120)
	private String signataireNom;

	/** Clé de scope GELÉE — claim {@code dept}. Le champ que la garde vérifie. */
	@Column(length = 50)
	private String departementId;

	/** Identité institutionnelle GELÉE — claim {@code urdId}. Affichage/audit, jamais une garde. */
	@Column(length = 50)
	private String urdId;

	@Column(length = 40)
	private String role;

	// ── Gel du contenu (hash-gel) ────────────────────────────────────────────
	@Column(nullable = false, length = 64)
	private String contentHash;

	@Lob
	@Column(nullable = false)
	private String snapshotJson;

	// ── Couche d'examen (l'attestation de l'écran superviseur) ────────────────
	@Column(nullable = false)
	private boolean attCompletude;

	@Column(nullable = false)
	private boolean attCoherence;

	@Column(nullable = false)
	private boolean attTerritorialite;

	@Column(length = 20)
	private String prioriteReevaluee;

	@Column(length = 400)
	private String commentaire;

	// ── Cycle de vie de la signature ─────────────────────────────────────────
	/** ACTIVE en dur à la création. SUPERSEDEE n'a pas encore de déclencheur (capacité dormante). */
	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 12)
	private Etat etat = Etat.ACTIVE;

	@Column(nullable = false, updatable = false)
	private Instant signeLe = Instant.now();

	@Column
	private Instant supersededLe;

	@Column(length = 50)
	private String supersededParId;

	protected RapportSignatureEntity() {}

	public RapportSignatureEntity(String rapportId, String signataireUsername, String signataireNom,
			String departementId, String urdId, String role,
			String contentHash, String snapshotJson,
			boolean attCompletude, boolean attCoherence, boolean attTerritorialite,
			String prioriteReevaluee, String commentaire, Instant signeLe) {
		this.id                 = UUID.randomUUID().toString();
		this.rapportId          = rapportId;
		this.signataireUsername = signataireUsername;
		this.signataireNom      = signataireNom;
		this.departementId      = departementId;
		this.urdId              = urdId;
		this.role               = role;
		this.contentHash        = contentHash;
		this.snapshotJson       = snapshotJson;
		this.attCompletude      = attCompletude;
		this.attCoherence       = attCoherence;
		this.attTerritorialite  = attTerritorialite;
		this.prioriteReevaluee  = prioriteReevaluee;
		this.commentaire        = commentaire;
		this.etat               = Etat.ACTIVE;
		this.signeLe            = signeLe != null ? signeLe : Instant.now();
	}

	public String getId()                 { return id; }
	public String getRapportId()          { return rapportId; }
	public String getSignataireUsername() { return signataireUsername; }
	public String getSignataireNom()      { return signataireNom; }
	public String getDepartementId()      { return departementId; }
	public String getUrdId()              { return urdId; }
	public String getRole()               { return role; }
	public String getContentHash()        { return contentHash; }
	public String getSnapshotJson()       { return snapshotJson; }
	public boolean isAttCompletude()      { return attCompletude; }
	public boolean isAttCoherence()       { return attCoherence; }
	public boolean isAttTerritorialite()  { return attTerritorialite; }
	public String getPrioriteReevaluee()  { return prioriteReevaluee; }
	public String getCommentaire()        { return commentaire; }
	public Etat getEtat()                 { return etat; }
	public Instant getSigneLe()           { return signeLe; }
	public Instant getSupersededLe()      { return supersededLe; }
	public String getSupersededParId()    { return supersededParId; }

	/**
	 * SEULE transition légale future de {@code etat} : une réouverture (admin DINEPA qui rejette)
	 * crée une nouvelle signature ACTIVE et supersède celle-ci. Dormant aujourd'hui — aucun
	 * endpoint ne l'appelle. C'est la capacité provisionnée, pas un setter libre.
	 */
	public void superseder(String parId, Instant when) {
		this.etat            = Etat.SUPERSEDEE;
		this.supersededParId = parId;
		this.supersededLe    = when != null ? when : Instant.now();
	}
}
