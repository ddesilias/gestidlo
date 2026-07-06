package com.example.api_metier.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Affectation d'une PERSONNE (technicien / TEPAC) sur une INTERVENTION (le ticket persisté,
 * né d'une alerte). Relation N:M : une intervention peut mobiliser plusieurs personnes, une
 * personne peut enchaîner plusieurs interventions dans le temps.
 *
 * <p>La disponibilité n'est JAMAIS stockée : elle se dérive de l'existence d'une affectation
 * OUVERTE ({@code closedAt == null}). « Affecter » crée une affectation ouverte ; « Libérer »
 * la ferme. C'est ce lien qui boucle alerte → intervention → équipe et qui peuplera la page
 * Interventions à partir de données réelles (ticket + affectations) plutôt que d'un mock.
 *
 * <p>{@code commune} est dénormalisée depuis le ticket → scope sans jointure, comme partout.
 */
@Entity
@Table(name = "affectation")
public class AffectationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Intervention = ticket persisté (le seul « intervention » réel côté serveur). */
    @Column(nullable = false)
    private Long ticketId;

    @Column(nullable = false, length = 80)
    private String personneUsername;

    /** Nom dénormalisé de la personne (affichage sans jointure). */
    @Column(length = 160)
    private String personneNom;

    /** Commune héritée du ticket → périmètre fin, filtrable sans jointure. */
    @Column(length = 80)
    private String commune;

    @Column(nullable = false)
    private Instant createdAt;

    /** {@code null} = affectation OUVERTE (la personne est « sur intervention »). */
    @Column
    private Instant closedAt;

    @Column(length = 80)
    private String affectePar;

    /** Rôle sur l'intervention : PRINCIPAL | APPUI. Défaut PRINCIPAL (lien historique). */
    @Column(length = 20)
    private String role = "PRINCIPAL";

    /** Décision de la personne : ASSIGNE | ACCEPTE | REFUSE. L'accept/refus est PER-personne ;
     * le statut du ticket reflète la décision du PRINCIPAL. */
    @Column(length = 20)
    private String statut = "ASSIGNE";

    protected AffectationEntity() {}

    public AffectationEntity(Long ticketId, String personneUsername, String personneNom,
                             String commune, Instant createdAt, String affectePar) {
        this.ticketId         = ticketId;
        this.personneUsername = personneUsername;
        this.personneNom      = personneNom;
        this.commune          = commune;
        this.createdAt        = createdAt;
        this.affectePar       = affectePar;
    }

    public Long getId()                 { return id; }
    public Long getTicketId()           { return ticketId; }
    public String getPersonneUsername() { return personneUsername; }
    public String getPersonneNom()      { return personneNom; }
    public String getCommune()          { return commune; }
    public Instant getCreatedAt()       { return createdAt; }
    public Instant getClosedAt()        { return closedAt; }
    public String getAffectePar()       { return affectePar; }
    public String getRole()             { return role; }
    public void setRole(String v)       { this.role = (v == null || v.isBlank()) ? "PRINCIPAL" : v; }
    public String getStatut()           { return statut; }
    public void setStatut(String v)     { this.statut = (v == null || v.isBlank()) ? "ASSIGNE" : v; }

    public boolean estOuverte() { return closedAt == null; }

    public void fermer(Instant when) { this.closedAt = when; }
}
