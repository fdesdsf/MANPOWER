package com.manpower.controller;

import com.manpower.entity.Meeting;
//import com.manpower.entity.Group;
import com.manpower.service.MeetingService;
import com.manpower.repository.GroupRepository;
import com.manpower.dto.ErrorResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/meetings")
@CrossOrigin(origins = "*")
public class MeetingController {

    @Autowired
    private MeetingService meetingService;

    @Autowired
    private GroupRepository groupRepository;

    @PostMapping
    public ResponseEntity<Object> createMeeting(@RequestBody Meeting meeting) {
        try {
            String role = meeting.getCalledByRole();
            String target = meeting.getTargetAudience();

            // ✅ Validate required fields
            if (meeting.getTitle() == null || meeting.getAgenda() == null ||
                meeting.getMeetingDate() == null || meeting.getMeetingTime() == null ||
                role == null || target == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(new ErrorResponse("Missing required meeting fields."));
            }

            // ✅ Rule 1: SuperAdmin logic
            if ("SuperAdmin".equalsIgnoreCase(role)) {
                if (!"GroupAdmins".equalsIgnoreCase(target)) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(new ErrorResponse("SuperAdmin can only target GroupAdmins."));
                }

                if (meeting.getGroup() != null) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(new ErrorResponse("SuperAdmin should not assign a specific group."));
                }
            }

            // ✅ Rule 2: GroupAdmin logic
            if ("GroupAdmin".equalsIgnoreCase(role)) {
                if (!"GroupMembers".equalsIgnoreCase(target)) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(new ErrorResponse("GroupAdmin can only target GroupMembers."));
                }

                if (meeting.getGroup() == null || meeting.getGroup().getId() == null ||
                    !groupRepository.existsById(meeting.getGroup().getId())) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(new ErrorResponse("GroupAdmin must provide a valid group."));
                }
            }

            // ✅ Save meeting
            Meeting saved = meetingService.saveMeeting(meeting);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to schedule meeting: " + e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<List<Meeting>> getAllMeetings() {
        List<Meeting> meetings = meetingService.getAllMeetings();
        return ResponseEntity.ok(meetings);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Object> getMeetingById(@PathVariable String id) {
        Optional<Meeting> meeting = meetingService.getMeetingById(id);
        return meeting
                .<ResponseEntity<Object>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ErrorResponse("Meeting not found with ID: " + id)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Object> deleteMeeting(@PathVariable String id) {
        try {
            meetingService.deleteMeeting(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to delete meeting: " + e.getMessage()));
        }
    }
}
