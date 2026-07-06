package com.example.api_metier.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

/** Clé composite de la liaison N–N ressource ↔ département. */
@Embeddable
public class RessourceDepartementId implements Serializable {

    @Column(nullable = false, length = 50)
    private String ressourceId;

    @Column(nullable = false, length = 50)
    private String departementId;

    protected RessourceDepartementId() {}

    public RessourceDepartementId(String ressourceId, String departementId) {
        this.ressourceId   = ressourceId;
        this.departementId = departementId;
    }

    public String getRessourceId()   { return ressourceId; }
    public String getDepartementId() { return departementId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        RessourceDepartementId that = (RessourceDepartementId) o;
        return Objects.equals(ressourceId, that.ressourceId)
            && Objects.equals(departementId, that.departementId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(ressourceId, departementId);
    }
}
