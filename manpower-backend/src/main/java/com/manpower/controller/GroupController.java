package com.manpower.controller;

import com.manpower.entity.Group;
import com.manpower.service.GroupService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@CrossOrigin(origins = {"http://localhost:8081", "http://192.168.0.103:8081"})
@RestController
@RequestMapping("/api/groups")
public class GroupController {

    private final GroupService groupService;

    @Autowired
    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

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
}
