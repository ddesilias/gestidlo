package com.example.api_metier.repo;

import com.example.api_metier.domain.NotificationEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<NotificationEntity, Long> {

    /** Toutes les notifications d'un utilisateur, les plus récentes d'abord. */
    List<NotificationEntity> findByUsernameOrderByCreatedAtDesc(String username);

    /** Notifications non lues (ou lues) d'un utilisateur. */
    List<NotificationEntity> findByUsernameAndLuOrderByCreatedAtDesc(String username, boolean lu);
}
