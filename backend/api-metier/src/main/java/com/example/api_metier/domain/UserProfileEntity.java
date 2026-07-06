package com.example.api_metier.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "user_profiles")
public class UserProfileEntity {

    @Id
    @Column(nullable = false, length = 80)
    private String username;

    @Column(nullable = false, length = 120)
    private String nom;

    @Column(unique = true, length = 120)
    private String email;

    @Column(length = 30)
    private String telephone;

    @Column(length = 100)
    private String fonction;

    @Column(nullable = false, length = 50)
    private String role;

    @Column(length = 20)
    private String initiales;

    // Périmètre
    @Column(length = 50)
    private String urdId;

    @Column(length = 60)
    private String orepa;

    @Column(length = 50)
    private String dept;

    @Column(length = 80)
    private String commune;

    @Column(length = 200)
    private String permissions;

    // Cycle de vie
    @Column(nullable = false, length = 20)
    private String statut = "actif";

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(length = 80)
    private String createdBy;

    protected UserProfileEntity() {}

    public UserProfileEntity(String username, String nom, String email, String telephone,
                              String fonction, String role, String initiales,
                              String urdId, String orepa, String dept,
                              String permissions, String createdBy) {
        this.username    = username;
        this.nom         = nom;
        this.email       = email;
        this.telephone   = telephone;
        this.fonction    = fonction;
        this.role        = role;
        this.initiales   = initiales;
        this.urdId       = urdId;
        this.orepa       = orepa;
        this.dept        = dept;
        this.permissions = permissions;
        this.createdBy   = createdBy;
    }

    // ── Getters ──────────────────────────────────────────────────────
    public String getUsername()    { return username;    }
    public String getNom()         { return nom;         }
    public String getEmail()       { return email;       }
    public String getTelephone()   { return telephone;   }
    public String getFonction()    { return fonction;    }
    public String getRole()        { return role;        }
    public String getInitiales()   { return initiales;   }
    public String getUrdId()       { return urdId;       }
    public String getOrepa()       { return orepa;       }
    public String getDept()        { return dept;        }
    public String getCommune()     { return commune;     }
    public String getPermissions() { return permissions; }
    public String getStatut()      { return statut;      }
    public Instant getCreatedAt()  { return createdAt;   }
    public String getCreatedBy()   { return createdBy;   }

    // ── Setters ──────────────────────────────────────────────────────
    public void setStatut(String statut)   { this.statut = statut; }
    public void setCommune(String commune) { this.commune = commune; }
}
