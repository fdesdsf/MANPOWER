package com.manpower.service;

import com.manpower.entity.Group;
import com.manpower.entity.Member;
import com.manpower.enums.MemberRole;
import com.manpower.repository.GroupRepository;
import com.manpower.repository.MemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class GroupServiceImp implements GroupService {

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private MemberRepository memberRepository;

    // ========== EXISTING METHODS (UNCHANGED) ==========
    
    @Override
    public List<Group> getAllGroups() {
        return groupRepository.findAll();
    }

    @Override
    public Optional<Group> getGroupById(String id) {
        return groupRepository.findById(id);
    }

    @Override
    public Group saveGroup(Group group) {
        Member creator = memberRepository.findById(group.getCreatedBy())
                .orElseThrow(() -> new RuntimeException("❌ Creator not found: " + group.getCreatedBy()));

        if (creator.getRole() != MemberRole.GroupAdmin && creator.getRole() != MemberRole.SuperAdmin) {
            throw new RuntimeException("❌ Only GroupAdmin or SuperAdmin can create groups");
        }

        return groupRepository.save(group);
    }

    @Override
    public void deleteGroup(String id) {
        groupRepository.deleteById(id);
    }

    @Override
    public List<Group> getGroupsByCreator(String creatorId) {
        Member creator = memberRepository.findById(creatorId)
                .orElseThrow(() -> new RuntimeException("❌ Creator not found: " + creatorId));

        if (creator.getRole() != MemberRole.GroupAdmin && creator.getRole() != MemberRole.SuperAdmin) {
            throw new RuntimeException("❌ Only GroupAdmin or SuperAdmin can view their groups");
        }

        return groupRepository.findByCreatedBy(creatorId);
    }

    @Override
    public Group terminateGroup(String id) {
        Group group = groupRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("❌ Group not found with ID: " + id));

        group.setStatus("Terminated");
        return groupRepository.save(group);
    }
    
    // ========== NEW MPESA METHODS ==========
    
    @Override
    @Transactional
    public Group configureGroupMpesa(String groupId, 
                                    String consumerKey, 
                                    String consumerSecret, 
                                    String businessShortcode, 
                                    String passkey, 
                                    String callbackUrl) {
        
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("❌ Group not found with ID: " + groupId));
        
        // Validate that the user has permission (GroupAdmin or SuperAdmin)
        Member admin = memberRepository.findById(group.getCreatedBy())
                .orElseThrow(() -> new RuntimeException("❌ Admin not found for group"));
                
        if (admin.getRole() != MemberRole.GroupAdmin && admin.getRole() != MemberRole.SuperAdmin) {
            throw new RuntimeException("❌ Only GroupAdmin or SuperAdmin can configure MPESA");
        }
        
        // Set MPESA credentials
        group.setMpesaConsumerKey(consumerKey);
        group.setMpesaConsumerSecret(consumerSecret);
        group.setMpesaBusinessShortcode(businessShortcode);
        group.setMpesaPasskey(passkey);
        group.setMpesaCallbackUrl(callbackUrl);
        group.setMpesaIsActive(true);
        group.setMpesaLastConfigured(LocalDateTime.now());
        
        return groupRepository.save(group);
    }
    
    @Override
    @Transactional
    public Group toggleGroupMpesa(String groupId, boolean isActive) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("❌ Group not found with ID: " + groupId));
        
        // Validate permissions
        Member admin = memberRepository.findById(group.getCreatedBy())
                .orElseThrow(() -> new RuntimeException("❌ Admin not found for group"));
                
        if (admin.getRole() != MemberRole.GroupAdmin && admin.getRole() != MemberRole.SuperAdmin) {
            throw new RuntimeException("❌ Only GroupAdmin or SuperAdmin can toggle MPESA");
        }
        
        group.setMpesaIsActive(isActive);
        if (isActive) {
            group.setMpesaLastConfigured(LocalDateTime.now());
        }
        
        return groupRepository.save(group);
    }
    
    @Override
    public Optional<Group> getGroupWithActiveMpesa(String groupId) {
        return groupRepository.findByIdAndMpesaIsActiveTrue(groupId);
    }
    
    @Override
    public List<Group> getAllGroupsWithActiveMpesa() {
        return groupRepository.findByMpesaIsActiveTrue();
    }
    
    @Override
    @Transactional
    public Group updateMpesaCallbackUrl(String groupId, String callbackUrl) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("❌ Group not found with ID: " + groupId));
        
        // Validate permissions
        Member admin = memberRepository.findById(group.getCreatedBy())
                .orElseThrow(() -> new RuntimeException("❌ Admin not found for group"));
                
        if (admin.getRole() != MemberRole.GroupAdmin && admin.getRole() != MemberRole.SuperAdmin) {
            throw new RuntimeException("❌ Only GroupAdmin or SuperAdmin can update callback URL");
        }
        
        group.setMpesaCallbackUrl(callbackUrl);
        group.setMpesaLastConfigured(LocalDateTime.now());
        
        return groupRepository.save(group);
    }
}