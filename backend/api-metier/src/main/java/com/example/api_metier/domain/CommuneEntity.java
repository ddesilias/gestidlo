package com.example.api_metier.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Commune administrative, rattachée à un département (et un arrondissement).
 * Source UNIQUE des communes proposées dans les formulaires : le périmètre est imposé
 * par le serveur (un superviseur ne reçoit que les communes de son département).
 */
@Entity
@Table(name = "commune")
public class CommuneEntity {

    @Id
    @Column(length = 120)
    private String id;

    @Column(nullable = false, length = 80)
    private String nom;

    @Column(length = 80)
    private String arrondissement;

    @Column(nullable = false, length = 50)
    private String departementId;

    protected CommuneEntity() {}

    public CommuneEntity(String id, String nom, String arrondissement, String departementId) {
        this.id             = id;
        this.nom            = nom;
        this.arrondissement = arrondissement;
        this.departementId  = departementId;
    }

    public String getId()             { return id; }
    public String getNom()            { return nom; }
    public String getArrondissement() { return arrondissement; }
    public String getDepartementId()  { return departementId; }
}
