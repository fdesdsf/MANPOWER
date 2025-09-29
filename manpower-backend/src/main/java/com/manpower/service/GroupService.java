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
}