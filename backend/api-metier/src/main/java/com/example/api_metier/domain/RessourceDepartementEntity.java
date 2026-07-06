package com.example.api_metier.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * Liaison N–N entre une ressource et un département — pièce centrale du scoping
 * départemental. Une source : 1 ligne (principale, quote-part = 1). Une rivière /
 * un bassin : N lignes, une seule marquée principale.
 *
 * <p>{@code estPrincipal} = département comptable (point de prélèvement) → sert à
 * compter le patrimoine/menace sans double comptage. {@code quotePartDebit} = part
 * du débit imputée à ce département : 1.0 sur le principal et 0.0 ailleurs par défaut
 * (convention « point de prélèvement », total national exact), redistribuable en
 * quote-part proportionnelle plus tard sans changer le schéma ni les requêtes KPI.
 */
@Entity
@Table(name = "ressource_departement")
public class RessourceDepartementEntity {

    @EmbeddedId
    private RessourceDepartementId id;

    @Column(nullable = false)
    private boolean estPrincipal = false;

    @Column(nullable = false)
    private double quotePartDebit = 1.0;

    protected RessourceDepartementEntity() {}

    public RessourceDepartementEntity(String ressourceId, String departementId,
                                      boolean estPrincipal, double quotePartDebit) {
        this.id             = new RessourceDepartementId(ressourceId, departementId);
        this.estPrincipal   = estPrincipal;
        this.quotePartDebit = quotePartDebit;
    }

    public RessourceDepartementId getId() { return id; }
    public String getRessourceId()        { return id.getRessourceId(); }
    public String getDepartementId()      { return id.getDepartementId(); }
    public boolean isEstPrincipal()       { return estPrincipal; }
    public double getQuotePartDebit()     { return quotePartDebit; }

    public void setEstPrincipal(boolean estPrincipal)     { this.estPrincipal = estPrincipal; }
    public void setQuotePartDebit(double quotePartDebit)  { this.quotePartDebit = quotePartDebit; }
}
