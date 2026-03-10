package com.manpower.service;

import com.manpower.entity.Group;
import java.util.List;
import java.util.Optional;

public interface GroupService {

    List<Group> getAllGroups();

    Optional<Group> getGroupById(String id);

    Group saveGroup(Group group);

    void deleteGroup(String id);

    List<Group> getGroupsByCreator(String creatorId);

    Group terminateGroup(String id);
    
    // ========== NEW MPESA METHODS ==========
    
    // Configure MPESA credentials for a group
    Group configureGroupMpesa(String groupId, 
                             String consumerKey, 
                             String consumerSecret, 
                             String businessShortcode, 
                             String passkey, 
                             String callbackUrl);
    
    // Activate/Deactivate MPESA for a group
    Group toggleGroupMpesa(String groupId, boolean isActive);
    
    // Get group with MPESA credentials (for payment processing)
    Optional<Group> getGroupWithActiveMpesa(String groupId);
    
    // Get all groups with active MPESA
    List<Group> getAllGroupsWithActiveMpesa();
    
    // Update MPESA callback URL
    Group updateMpesaCallbackUrl(String groupId, String callbackUrl);
}