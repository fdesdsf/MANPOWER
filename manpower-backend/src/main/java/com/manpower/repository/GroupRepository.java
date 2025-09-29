package com.manpower.repository;

import com.manpower.entity.Group;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GroupRepository extends JpaRepository<Group, String> {

    // ✅ Add this method to fetch groups created by a specific GroupAdmin (by ID)
    List<Group> findByCreatedBy(String createdBy);
}
