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
 * Registre des capteurs IoT (un capteur = un device physique déclaré sur un ouvrage).
 *
 * <p>Avant, un « capteur » était dérivé d'un PointRef + dernière mesure ; ici il devient une
 * entité de plein droit pour porter le cycle de validation (déclaration TEPAC → validation
 * superviseur) et le lien device↔ouvrage. Territoire dénormalisé ({@code department}/
 * {@code commune}) → scope sans jointure. Les champs « live » ({@code lastValue}, {@code lastSeen},
 * {@code battery}, {@code signal}) sont mis à jour par l'ingestion temps réel (HTTP /api/iot/measurements),
 * corrélée par {@code code} = {@code sensorCode} du message.
 */
@Entity
@Table(name = "capteur")
public class CapteurEntity {

    @Id
    @Column(nullable = false, length = 50)
    private String id;

    /** Code capteur (= sensorCode des mesures), unique. Ex. CPT-PR-CAR-001. */
    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false, length = 160)
    private String nom;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CapteurType type;

    @Column(nullable = false, length = 80)
    private String department;

    @Column(length = 80)
    private String commune;

    /** Ouvrage instrumenté (id + libellé dénormalisé pour l'affichage). */
    @Column(length = 50)
    private String ouvrageId;

    @Column(length = 160)
    private String ouvrageNom;

    /** Identité matérielle / connectivité (métadonnées d'affichage). */
    @Column(length = 80)
    private String deviceId;

    @Column(length = 200)
    private String mqttTopic;

    @Column(length = 12)
    private String unit;

    @Column
    private Double lat;

    @Column
    private Double lon;

    // ── Live (mis à jour par l'ingestion) ──
    @Column
    private Double lastValue;

    @Column
    private Instant lastSeen;

    @Column
    private Integer battery;

    @Column
    private Integer signal;

    // ── Cycle de validation ──
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private CapteurValidation statut = CapteurValidation.VALIDEE;

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

    protected CapteurEntity() {}

    public CapteurEntity(String id, String code, String nom, CapteurType type,
                         String department, String commune, String ouvrageId, String ouvrageNom,
                         String deviceId, String mqttTopic, String unit, Double lat, Double lon,
                         String createdBy) {
        this.id         = (id == null || id.isBlank()) ? UUID.randomUUID().toString() : id;
        this.code       = code;
        this.nom        = nom;
        this.type       = type;
        this.department = department;
        this.commune    = commune;
        this.ouvrageId  = ouvrageId;
        this.ouvrageNom = ouvrageNom;
        this.deviceId   = deviceId;
        this.mqttTopic  = mqttTopic;
        this.unit       = unit;
        this.lat        = lat;
        this.lon        = lon;
        this.createdBy  = createdBy;
    }

    public String getId()              { return id; }
    public String getCode()            { return code; }
    public String getNom()             { return nom; }
    public CapteurType getType()       { return type; }
    public String getDepartment()      { return department; }
    public String getCommune()         { return commune; }
    public String getOuvrageId()       { return ouvrageId; }
    public String getOuvrageNom()      { return ouvrageNom; }
    public String getDeviceId()        { return deviceId; }
    public String getMqttTopic()       { return mqttTopic; }
    public String getUnit()            { return unit; }
    public Double getLat()             { return lat; }
    public Double getLon()             { return lon; }
    public Double getLastValue()       { return lastValue; }
    public Instant getLastSeen()       { return lastSeen; }
    public Integer getBattery()        { return battery; }
    public Integer getSignal()         { return signal; }
    public CapteurValidation getStatut() { return statut; }
    public String getValidatedBy()     { return validatedBy; }
    public Instant getValidatedAt()    { return validatedAt; }
    public String getMotifRejet()      { return motifRejet; }
    public Instant getCreatedAt()      { return createdAt; }
    public String getCreatedBy()       { return createdBy; }

    public void setStatut(CapteurValidation statut) { this.statut = statut; }

    /** Rattache le capteur à un ouvrage (station) — la vue station agrège par ouvrageId. */
    public void setOuvrage(String ouvrageId, String ouvrageNom) {
        this.ouvrageId  = ouvrageId;
        this.ouvrageNom = ouvrageNom;
    }

    /** Mise à jour live à chaque mesure reçue (ingestion temps réel). */
    public void onMeasure(Double value, String unit, Integer battery, Integer signal, Instant when) {
        this.lastValue = value;
        if (unit != null && !unit.isBlank()) this.unit = unit;
        if (battery != null) this.battery = battery;
        if (signal != null)  this.signal = signal;
        this.lastSeen = when;
    }

    public void valider(String by, Instant when) {
        this.statut = CapteurValidation.VALIDEE;
        this.validatedBy = by; this.validatedAt = when; this.motifRejet = null;
    }

    public void rejeter(String by, Instant when, String motif) {
        this.statut = CapteurValidation.REJETEE;
        this.validatedBy = by; this.validatedAt = when; this.motifRejet = motif;
    }
}
