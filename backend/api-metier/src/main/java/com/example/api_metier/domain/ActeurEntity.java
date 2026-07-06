package com.example.api_metier.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Acteur de la gouvernance de l'eau d'un département (formulaire discriminé par type).
 *
 * <p>Champs communs + champs spécifiques par type (nullable) — un seul tableau couvre
 * les 5 familles, comme le FormGroup discriminé côté front. {@code departementId} est
 * le périmètre : il vient du scope (jamais choisi librement) et est revérifié au POST.
 * Contraintes métier appliquées dans le contrôleur : un seul TEPAC et une seule mairie
 * par commune.
 */
@Entity
@Table(name = "acteur")
public class ActeurEntity {

    @Id
    @Column(nullable = false, length = 50)
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ActeurType type;

    @Column(nullable = false, length = 160)
    private String nom;

    @Column(nullable = false, length = 50)
    private String departementId;

    @Column(length = 80)
    private String commune;          // TEPAC, mairie, caepa

    @Column(length = 40)
    private String sousType;         // opérateur: prive/ong/kiosque/regie · partenaire: domaine

    @Column(length = 120)
    private String maitreOuvrage;    // opérateur

    @Column(length = 40)
    private String typeContrat;      // opérateur: convention/affermage/gerance…

    @Column
    private Integer periodeDebut;

    @Column
    private Integer periodeFin;

    @Column(length = 400)
    private String ouvrageIds;       // opérateur: CSV d'ids d'ouvrages exploités

    @Column(length = 80)
    private String zoneId;           // caepa: zone gérée

    @Column(length = 120)
    private String responsable;      // mairie/caepa: personne référente

    @Column(length = 30)
    private String contactTel;

    /** Identifiant du compte de connexion lié (TEPAC avec compte), sinon null. */
    @Column(length = 80)
    private String compteUsername;

    @Column(nullable = false, length = 20)
    private String statut = "actif";

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(length = 80)
    private String createdBy;

    /** Soft-delete : non null = archivé/supprimé par un admin. Les requêtes filtrent IS NULL. */
    @Column
    private Instant supprimeLe;

    protected ActeurEntity() {}

    public ActeurEntity(String id, ActeurType type, String nom, String departementId,
                        String commune, String sousType, String maitreOuvrage, String typeContrat,
                        Integer periodeDebut, Integer periodeFin, String ouvrageIds, String zoneId,
                        String responsable, String contactTel, String statut, String createdBy) {
        this.id            = (id == null || id.isBlank()) ? UUID.randomUUID().toString() : id;
        this.type          = type;
        this.nom           = nom;
        this.departementId = departementId;
        this.commune       = commune;
        this.sousType      = sousType;
        this.maitreOuvrage = maitreOuvrage;
        this.typeContrat   = typeContrat;
        this.periodeDebut  = periodeDebut;
        this.periodeFin    = periodeFin;
        this.ouvrageIds    = ouvrageIds;
        this.zoneId        = zoneId;
        this.responsable   = responsable;
        this.contactTel    = contactTel;
        this.statut        = (statut == null || statut.isBlank()) ? "actif" : statut;
        this.createdBy     = createdBy;
    }

    public String getId()             { return id; }
    public ActeurType getType()       { return type; }
    public String getNom()            { return nom; }
    public String getDepartementId()  { return departementId; }
    public String getCommune()        { return commune; }
    public String getSousType()       { return sousType; }
    public String getMaitreOuvrage()  { return maitreOuvrage; }
    public String getTypeContrat()    { return typeContrat; }
    public Integer getPeriodeDebut()  { return periodeDebut; }
    public Integer getPeriodeFin()    { return periodeFin; }
    public String getOuvrageIds()     { return ouvrageIds; }
    public String getZoneId()         { return zoneId; }
    public String getResponsable()    { return responsable; }
    public String getContactTel()     { return contactTel; }
    public String getCompteUsername() { return compteUsername; }
    public String getStatut()         { return statut; }
    public Instant getCreatedAt()     { return createdAt; }
    public String getCreatedBy()      { return createdBy; }
    public Instant getSupprimeLe()    { return supprimeLe; }

    public void setStatut(String statut)                 { this.statut = statut; }
    public void setCompteUsername(String compteUsername) { this.compteUsername = compteUsername; }
    public void setSupprimeLe(Instant supprimeLe)        { this.supprimeLe = supprimeLe; }
}
