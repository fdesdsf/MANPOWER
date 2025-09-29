package com.manpower.service;

import com.manpower.entity.Group;
import com.manpower.entity.Member;
import com.manpower.enums.MemberRole;
import com.manpower.repository.GroupRepository;
import com.manpower.repository.MemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service // Spring will automatically detect this as the implementation of GroupService
public class GroupServiceImp implements GroupService {

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private MemberRepository memberRepository;

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
}