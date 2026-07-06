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
 * Patrimoine naturel en eau (source, rivière, bassin versant).
 *
 * <p>Géométrie : on stocke ici un point de référence (lat/lon) — suffisant pour H2 et
 * pour l'affichage carto actuel. En production PostGIS, ce point serait remplacé par
 * une colonne {@code geometry(Geometry,4326)} (POINT | LINESTRING | POLYGON) et la
 * dérivation des départements traversés se ferait via {@code ST_Intersects}. Ici la
 * dérivation est applicative : le rattachement département vit dans la table de
 * liaison {@link RessourceDepartementEntity} (relation N–N).
 */
@Entity
@Table(name = "ressource")
public class RessourceEntity {

    @Id
    @Column(nullable = false, length = 50)
    private String id;

    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @Column(nullable = false, length = 160)
    private String nom;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RessourceType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RessourceEtat etat = RessourceEtat.SAINE;

    /** Débit naturel disponible (m³/h). */
    @Column
    private Double debitM3h;

    @Column
    private Double lat;

    @Column
    private Double lon;

    @Column(length = 80)
    private String commune;

    @Column(length = 80)
    private String section;

    /**
     * Cycle de validation. Défaut {@link RessourceStatut#VALIDEE} : une ressource créée par un
     * superviseur/admin (ou seedée) est officielle d'office ; le chemin de recensement TEPAC
     * force {@link RessourceStatut#EN_ATTENTE_VALIDATION} explicitement.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private RessourceStatut statut = RessourceStatut.VALIDEE;

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

    protected RessourceEntity() {}

    public RessourceEntity(String id, String code, String nom, RessourceType type, RessourceEtat etat,
                           Double debitM3h, Double lat, Double lon, String commune, String section,
                           String createdBy) {
        this.id        = (id == null || id.isBlank()) ? UUID.randomUUID().toString() : id;
        this.code      = code;
        this.nom       = nom;
        this.type      = type;
        this.etat      = etat == null ? RessourceEtat.SAINE : etat;
        this.debitM3h  = debitM3h;
        this.lat       = lat;
        this.lon       = lon;
        this.commune   = commune;
        this.section   = section;
        this.createdBy = createdBy;
    }

    public String getId()            { return id; }
    public String getCode()          { return code; }
    public String getNom()           { return nom; }
    public RessourceType getType()   { return type; }
    public RessourceEtat getEtat()   { return etat; }
    public Double getDebitM3h()      { return debitM3h; }
    public Double getLat()           { return lat; }
    public Double getLon()           { return lon; }
    public String getCommune()       { return commune; }
    public String getSection()       { return section; }
    public RessourceStatut getStatut() { return statut; }
    public String getValidatedBy()   { return validatedBy; }
    public Instant getValidatedAt()  { return validatedAt; }
    public String getMotifRejet()    { return motifRejet; }
    public Instant getCreatedAt()    { return createdAt; }
    public String getCreatedBy()     { return createdBy; }

    public void setNom(String nom)             { this.nom = nom; }
    public void setEtat(RessourceEtat etat)    { this.etat = etat; }
    public void setDebitM3h(Double debitM3h)   { this.debitM3h = debitM3h; }
    public void setStatut(RessourceStatut statut) { this.statut = statut; }

    /** Marque la ressource validée par un superviseur (statut officiel + traçabilité). */
    public void valider(String validatedBy, Instant when) {
        this.statut      = RessourceStatut.VALIDEE;
        this.validatedBy = validatedBy;
        this.validatedAt = when;
        this.motifRejet  = null;
    }

    /** Rejette la ressource recensée (avec motif obligatoire côté contrôleur). */
    public void rejeter(String validatedBy, Instant when, String motif) {
        this.statut      = RessourceStatut.REJETEE;
        this.validatedBy = validatedBy;
        this.validatedAt = when;
        this.motifRejet  = motif;
    }
}
