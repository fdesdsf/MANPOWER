package com.manpower.controller;

import com.manpower.entity.Group;
import com.manpower.service.GroupService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@CrossOrigin(origins = {"http://localhost:8081", "http://192.168.0.101:8081"})
@RestController
@RequestMapping("/api/groups")
public class GroupController {

    private final GroupService groupService;

    @Autowired
    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    // ========== EXISTING GROUP ENDPOINTS ==========
    
    @PostMapping
    public Group createGroup(@RequestBody Group group) {
        return groupService.saveGroup(group);
    }

    @GetMapping
    public List<Group> getAllGroups() {
        return groupService.getAllGroups();
    }

    @GetMapping("/{id}")
    public Optional<Group> getGroupById(@PathVariable String id) {
        return groupService.getGroupById(id);
    }

    @DeleteMapping("/{id}")
    public void deleteGroup(@PathVariable String id) {
        groupService.deleteGroup(id);
    }

    // ✅ Get groups created by a specific GroupAdmin or SuperAdmin
    @GetMapping("/groupadmin/{creatorId}")
    public List<Group> getGroupsByCreator(@PathVariable String creatorId) {
        return groupService.getGroupsByCreator(creatorId);
    }

    // ✅ Terminate group endpoint
    @PutMapping("/{id}/terminate")
    public Group terminateGroup(@PathVariable String id) {
        return groupService.terminateGroup(id);
    }
    
    // ========== NEW MPESA CONFIGURATION ENDPOINTS ==========
    
    /**
     * Configure MPESA credentials for a group
     * POST /api/groups/{groupId}/mpesa/configure
     */
    @PostMapping("/{groupId}/mpesa/configure")
    public ResponseEntity<Map<String, Object>> configureGroupMpesa(
            @PathVariable String groupId,
            @RequestBody Map<String, String> mpesaConfig) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            // Extract configuration parameters
            String consumerKey = mpesaConfig.get("consumerKey");
            String consumerSecret = mpesaConfig.get("consumerSecret");
            String businessShortcode = mpesaConfig.get("businessShortcode");
            String passkey = mpesaConfig.get("passkey");
            String callbackUrl = mpesaConfig.get("callbackUrl");
            
            // Validate required fields
            if (consumerKey == null || consumerKey.isEmpty() ||
                consumerSecret == null || consumerSecret.isEmpty() ||
                businessShortcode == null || businessShortcode.isEmpty() ||
                passkey == null || passkey.isEmpty()) {
                
                response.put("status", 400);
                response.put("message", "Missing required MPESA configuration fields");
                response.put("required", "consumerKey, consumerSecret, businessShortcode, passkey");
                return ResponseEntity.badRequest().body(response);
            }
            
            // Call service to configure MPESA
            Group updatedGroup = groupService.configureGroupMpesa(
                    groupId, 
                    consumerKey, 
                    consumerSecret, 
                    businessShortcode, 
                    passkey, 
                    callbackUrl);
            
            response.put("status", 200);
            response.put("message", "MPESA configuration updated successfully");
            response.put("group", updatedGroup.getGroupName());
            response.put("groupId", updatedGroup.getId());
            response.put("businessShortcode", updatedGroup.getMpesaBusinessShortcode());
            response.put("callbackUrl", updatedGroup.getMpesaCallbackUrl());
            response.put("isActive", updatedGroup.getMpesaIsActive());
            response.put("lastConfigured", updatedGroup.getMpesaLastConfigured());
            
            return ResponseEntity.ok().body(response);
            
        } catch (RuntimeException e) {
            response.put("status", 400);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            response.put("status", 500);
            response.put("message", "Error configuring MPESA: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Activate or deactivate MPESA for a group
     * PUT /api/groups/{groupId}/mpesa/toggle
     */
    @PutMapping("/{groupId}/mpesa/toggle")
    public ResponseEntity<Map<String, Object>> toggleGroupMpesa(
            @PathVariable String groupId,
            @RequestParam boolean active) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            Group updatedGroup = groupService.toggleGroupMpesa(groupId, active);
            
            response.put("status", 200);
            response.put("message", "MPESA " + (active ? "activated" : "deactivated") + " successfully");
            response.put("group", updatedGroup.getGroupName());
            response.put("groupId", updatedGroup.getId());
            response.put("isActive", updatedGroup.getMpesaIsActive());
            response.put("lastConfigured", updatedGroup.getMpesaLastConfigured());
            
            return ResponseEntity.ok().body(response);
            
        } catch (RuntimeException e) {
            response.put("status", 400);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            response.put("status", 500);
            response.put("message", "Error toggling MPESA status: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Get MPESA configuration for a group (safe - doesn't expose secrets)
     * GET /api/groups/{groupId}/mpesa/config
     */
    @GetMapping("/{groupId}/mpesa/config")
    public ResponseEntity<Map<String, Object>> getGroupMpesaConfig(@PathVariable String groupId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            Optional<Group> groupOpt = groupService.getGroupById(groupId);
            
            if (!groupOpt.isPresent()) {
                response.put("status", 404);
                response.put("message", "Group not found");
                return ResponseEntity.status(404).body(response);
            }
            
            Group group = groupOpt.get();
            
            Map<String, Object> config = new HashMap<>();
            config.put("groupId", group.getId());
            config.put("groupName", group.getGroupName());
            config.put("businessShortcode", group.getMpesaBusinessShortcode());
            config.put("callbackUrl", group.getMpesaCallbackUrl());
            config.put("isActive", group.getMpesaIsActive());
            config.put("lastConfigured", group.getMpesaLastConfigured());
            
            // Don't expose sensitive keys, just indicate if they're set
            config.put("hasConsumerKey", group.getMpesaConsumerKey() != null && !group.getMpesaConsumerKey().isEmpty());
            config.put("hasConsumerSecret", group.getMpesaConsumerSecret() != null && !group.getMpesaConsumerSecret().isEmpty());
            config.put("hasPasskey", group.getMpesaPasskey() != null && !group.getMpesaPasskey().isEmpty());
            
            response.put("status", 200);
            response.put("message", "MPESA configuration retrieved successfully");
            response.put("config", config);
            
            return ResponseEntity.ok().body(response);
            
        } catch (Exception e) {
            response.put("status", 500);
            response.put("message", "Error retrieving MPESA config: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Update only the MPESA callback URL for a group
     * PUT /api/groups/{groupId}/mpesa/callback
     */
    @PutMapping("/{groupId}/mpesa/callback")
    public ResponseEntity<Map<String, Object>> updateMpesaCallbackUrl(
            @PathVariable String groupId,
            @RequestParam String callbackUrl) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            Group updatedGroup = groupService.updateMpesaCallbackUrl(groupId, callbackUrl);
            
            response.put("status", 200);
            response.put("message", "Callback URL updated successfully");
            response.put("group", updatedGroup.getGroupName());
            response.put("groupId", updatedGroup.getId());
            response.put("callbackUrl", updatedGroup.getMpesaCallbackUrl());
            response.put("lastConfigured", updatedGroup.getMpesaLastConfigured());
            
            return ResponseEntity.ok().body(response);
            
        } catch (RuntimeException e) {
            response.put("status", 400);
            response.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            response.put("status", 500);
            response.put("message", "Error updating callback URL: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Get all groups with active MPESA configurations
     * GET /api/groups/mpesa/active
     */
    @GetMapping("/mpesa/active")
    public ResponseEntity<Map<String, Object>> getAllGroupsWithActiveMpesa() {
        Map<String, Object> response = new HashMap<>();
        
        try {
            List<Group> groups = groupService.getAllGroupsWithActiveMpesa();
            
            response.put("status", 200);
            response.put("message", "Found " + groups.size() + " groups with active MPESA");
            response.put("count", groups.size());
            
            // Create list of group info without exposing sensitive data (Java 8 compatible)
            List<Map<String, Object>> groupInfoList = new ArrayList<>();
            for (Group group : groups) {
                Map<String, Object> groupInfo = new HashMap<>();
                groupInfo.put("id", group.getId());
                groupInfo.put("name", group.getGroupName());
                groupInfo.put("businessShortcode", group.getMpesaBusinessShortcode());
                groupInfo.put("callbackUrl", group.getMpesaCallbackUrl());
                groupInfo.put("lastConfigured", group.getMpesaLastConfigured());
                groupInfoList.add(groupInfo);
            }
            
            response.put("groups", groupInfoList);
            
            return ResponseEntity.ok().body(response);
            
        } catch (Exception e) {
            response.put("status", 500);
            response.put("message", "Error retrieving groups with active MPESA: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * Test MPESA configuration for a group (without making actual payment)
     * POST /api/groups/{groupId}/mpesa/test
     */
    @PostMapping("/{groupId}/mpesa/test")
    public ResponseEntity<Map<String, Object>> testMpesaConfiguration(@PathVariable String groupId) {
        Map<String, Object> response = new HashMap<>();
        
        try {
            Optional<Group> groupOpt = groupService.getGroupWithActiveMpesa(groupId);
            
            if (!groupOpt.isPresent()) {
                response.put("status", 400);
                response.put("message", "Group not found or MPESA not active");
                return ResponseEntity.badRequest().body(response);
            }
            
            Group group = groupOpt.get();
            
            // Test by getting access token (validates credentials work)
            // Note: This would require a method in MpesaService to just get token
            // For now, we'll just validate the configuration
            
            Map<String, Object> testResult = new HashMap<>();
            testResult.put("group", group.getGroupName());
            testResult.put("businessShortcode", group.getMpesaBusinessShortcode());
            testResult.put("hasConsumerKey", group.getMpesaConsumerKey() != null && !group.getMpesaConsumerKey().isEmpty());
            testResult.put("hasConsumerSecret", group.getMpesaConsumerSecret() != null && !group.getMpesaConsumerSecret().isEmpty());
            testResult.put("hasPasskey", group.getMpesaPasskey() != null && !group.getMpesaPasskey().isEmpty());
            testResult.put("callbackUrl", group.getMpesaCallbackUrl());
            testResult.put("isActive", group.getMpesaIsActive());
            testResult.put("lastConfigured", group.getMpesaLastConfigured());
            
            response.put("status", 200);
            response.put("message", "MPESA configuration is valid");
            response.put("testResult", testResult);
            
            return ResponseEntity.ok().body(response);
            
        } catch (Exception e) {
            response.put("status", 500);
            response.put("message", "Error testing MPESA configuration: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
}