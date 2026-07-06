package com.example.api_metier.repo;

import com.example.api_metier.domain.UserProfileEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserProfileRepository extends JpaRepository<UserProfileEntity, String> {

    Optional<UserProfileEntity> findByEmailIgnoreCase(String email);

    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByTelephone(String telephone);

    List<UserProfileEntity> findByUrdId(String urdId);

    List<UserProfileEntity> findByStatutNot(String statut);

    /** Personnes d'un département (annuaire scopé superviseur), hors archivés. */
    List<UserProfileEntity> findByDeptIgnoreCaseAndStatutNot(String dept, String statut);

    /** Personnes d'une commune (périmètre fin TEPAC), hors archivés. */
    List<UserProfileEntity> findByCommuneIgnoreCaseAndStatutNot(String commune, String statut);

    /**
     * Fan-out de notification = l'inverse du read-scope : à partir de la commune (et de son
     * département) d'une alerte, on récupère les usernames de TOUS ceux dont le périmètre la
     * COUVRE — admin (national), superviseurs du département, TEPAC de la commune. Le créateur
     * est exclu (pas d'auto-notification). Comptes archivés exclus.
     */
    @Query("select p.username from UserProfileEntity p "
            + "where p.statut <> 'archive' and p.username <> :creator and ("
            + "  lower(p.role) like 'admin%' "
            + "  or (p.role = 'superviseur_urd' and lower(p.dept) = lower(:dept)) "
            + "  or (p.role = 'tepac' and lower(p.commune) = lower(:commune)) )")
    List<String> destinatairesAlerte(@Param("dept") String dept,
                                     @Param("commune") String commune,
                                     @Param("creator") String creator);

    /**
     * Destinataires d'un recensement de ressource à valider : ceux qui ont AUTORITÉ de validation
     * sur le département — admin (national) + superviseurs de l'URD du département. On ne notifie
     * pas les autres TEPAC (ils recensent, ils ne valident pas). Créateur et archivés exclus.
     */
    @Query("select p.username from UserProfileEntity p "
            + "where p.statut <> 'archive' and p.username <> :creator and ("
            + "  lower(p.role) like 'admin%' "
            + "  or (p.role = 'superviseur_urd' and lower(p.dept) = lower(:dept)) )")
    List<String> validateursDuDept(@Param("dept") String dept,
                                   @Param("creator") String creator);

    /**
     * Destinataires d'un rapport signé et transmis par un superviseur : les administrateurs
     * nationaux (DINEPA). C'est le bout final du relais terrain → URD → admin. Signataire et
     * archivés exclus.
     */
    @Query("select p.username from UserProfileEntity p "
            + "where p.statut <> 'archive' and p.username <> :creator and lower(p.role) like 'admin%'")
    List<String> adminsNationaux(@Param("creator") String creator);
}
