package com.example.api_metier.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Notification destinée à UN utilisateur (par username). Posée par le fan-out à la création
 * d'une alerte : on notifie tous ceux dont le périmètre COUVRE la commune de l'alerte
 * (admin national, superviseurs du département, TEPAC de la commune) — l'inverse exact du
 * read-scope, sur le même {@code commune} dénormalisé.
 */
@Entity
@Table(name = "notification")
public class NotificationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Destinataire (clé d'auth). */
    @Column(nullable = false, length = 80)
    private String username;

    @Column(nullable = false, length = 30)
    private String type;          // "ALERTE"

    @Column(nullable = false, length = 160)
    private String titre;

    @Column(length = 400)
    private String corps;

    @Column
    private Long alertId;

    @Column(length = 80)
    private String commune;

    @Column(nullable = false)
    private boolean lu = false;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected NotificationEntity() {}

    public NotificationEntity(String username, String type, String titre, String corps,
                              Long alertId, String commune, Instant createdAt) {
        this.username   = username;
        this.type       = type;
        this.titre      = titre;
        this.corps      = corps;
        this.alertId    = alertId;
        this.commune    = commune;
        this.createdAt  = createdAt;
    }

    public Long getId()           { return id; }
    public String getUsername()   { return username; }
    public String getType()       { return type; }
    public String getTitre()      { return titre; }
    public String getCorps()      { return corps; }
    public Long getAlertId()      { return alertId; }
    public String getCommune()    { return commune; }
    public boolean isLu()         { return lu; }
    public Instant getCreatedAt() { return createdAt; }

    public void setLu(boolean lu) { this.lu = lu; }
}
