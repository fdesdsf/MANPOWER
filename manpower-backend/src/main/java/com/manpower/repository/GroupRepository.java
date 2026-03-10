package com.manpower.repository;

import com.manpower.entity.Group;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupRepository extends JpaRepository<Group, String> {

    // ✅ Add this method to fetch groups created by a specific GroupAdmin (by ID)
    List<Group> findByCreatedBy(String createdBy);
    
    // ✅ NEW: Find groups with active MPESA configurations
    List<Group> findByMpesaIsActiveTrue();
    
    // ✅ NEW: Find a group by ID with active MPESA
    Optional<Group> findByIdAndMpesaIsActiveTrue(String id);
    
    // ✅ NEW: Find groups by business shortcode (useful for callbacks)
    Optional<Group> findByMpesaBusinessShortcode(String businessShortcode);
}