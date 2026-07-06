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
 * Patrimoine bâti (ouvrage hydraulique : captage, forage, station, réservoir, réseau…).
 *
 * <p>Contrairement à {@link RessourceEntity} (rattachement N–N car une rivière traverse
 * plusieurs départements), un ouvrage est ponctuel : son territoire est dénormalisé en
 * colonnes {@code department}/{@code commune}, scopables sans jointure (comme alertes/tickets).
 * Porte le cycle de validation (recensement TEPAC → décision superviseur).
 */
@Entity
@Table(name = "ouvrage")
public class OuvrageEntity {

    @Id
    @Column(nullable = false, length = 50)
    private String id;

    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @Column(nullable = false, length = 160)
    private String nom;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OuvrageType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OuvrageEtat etat = OuvrageEtat.OPERATIONNEL;

    @Column(nullable = false, length = 80)
    private String department;

    @Column(length = 80)
    private String commune;

    @Column(length = 80)
    private String section;

    @Column(length = 120)
    private String locality;

    @Column
    private Double lat;

    @Column
    private Double lon;

    @Column
    private Double capaciteM3h;

    @Column
    private Integer anneeConstruction;

    @Column(length = 50)
    private String resourceId;

    @Column(length = 160)
    private String resourceName;

    @Column(length = 500)
    private String notes;

    /** Cycle de validation. Défaut {@link OuvrageValidation#VALIDEE} (superviseur/admin/seed officiels). */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private OuvrageValidation statut = OuvrageValidation.VALIDEE;

    @Column(length = 80)
    private String validatedBy;

    @Column
    private Instant validatedAt;

    @Column(length = 300)
    private String motifRejet;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(length = 80)
    private String createdBy;

    protected OuvrageEntity() {}

    public OuvrageEntity(String id, String code, String nom, OuvrageType type, OuvrageEtat etat,
                         String department, String commune, String section, String locality,
                         Double lat, Double lon, Double capaciteM3h, Integer anneeConstruction,
                         String resourceId, String resourceName, String notes, String createdBy) {
        this.id           = (id == null || id.isBlank()) ? UUID.randomUUID().toString() : id;
        this.code         = code;
        this.nom          = nom;
        this.type         = type;
        this.etat         = etat == null ? OuvrageEtat.OPERATIONNEL : etat;
        this.department   = department;
        this.commune      = commune;
        this.section      = section;
        this.locality     = locality;
        this.lat          = lat;
        this.lon          = lon;
        this.capaciteM3h  = capaciteM3h;
        this.anneeConstruction = anneeConstruction;
        this.resourceId   = resourceId;
        this.resourceName = resourceName;
        this.notes        = notes;
        this.createdBy    = createdBy;
    }

    public String getId()                 { return id; }
    public String getCode()               { return code; }
    public String getNom()                { return nom; }
    public OuvrageType getType()          { return type; }
    public OuvrageEtat getEtat()          { return etat; }
    public String getDepartment()         { return department; }
    public String getCommune()            { return commune; }
    public String getSection()            { return section; }
    public String getLocality()           { return locality; }
    public Double getLat()                { return lat; }
    public Double getLon()                { return lon; }
    public Double getCapaciteM3h()        { return capaciteM3h; }
    public Integer getAnneeConstruction() { return anneeConstruction; }
    public String getResourceId()         { return resourceId; }
    public String getResourceName()       { return resourceName; }
    public String getNotes()              { return notes; }
    public OuvrageValidation getStatut()  { return statut; }
    public String getValidatedBy()        { return validatedBy; }
    public Instant getValidatedAt()       { return validatedAt; }
    public String getMotifRejet()         { return motifRejet; }
    public Instant getCreatedAt()         { return createdAt; }
    public String getCreatedBy()          { return createdBy; }

    public void setStatut(OuvrageValidation statut) { this.statut = statut; }
    public void setEtat(OuvrageEtat etat)           { this.etat = etat; }

    /** Marque l'ouvrage validé par un superviseur (statut officiel + traçabilité). */
    public void valider(String validatedBy, Instant when) {
        this.statut      = OuvrageValidation.VALIDEE;
        this.validatedBy = validatedBy;
        this.validatedAt = when;
        this.motifRejet  = null;
    }

    /** Rejette la soumission (motif obligatoire côté contrôleur). */
    public void rejeter(String validatedBy, Instant when, String motif) {
        this.statut      = OuvrageValidation.REJETEE;
        this.validatedBy = validatedBy;
        this.validatedAt = when;
        this.motifRejet  = motif;
    }
}
