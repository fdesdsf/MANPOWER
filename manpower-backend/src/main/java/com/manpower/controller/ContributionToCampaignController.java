package com.manpower.controller;

import com.manpower.dto.ContributionToCampaignRequest;
import com.manpower.dto.CampaignContributionResponse;
import com.manpower.service.ContributionToCampaignService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;

@RestController
@RequestMapping("/api/volunteer-contributions")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ContributionToCampaignController {

    private final ContributionToCampaignService contributionService;

    /**
     * Member contributes to a specific volunteer campaign
     * POST /api/volunteer-contributions/pay
     */
    @PostMapping("/pay")
    public ResponseEntity<?> contributeToCampaign(
            @Valid @RequestBody ContributionToCampaignRequest request,
            @RequestHeader("userId") String memberId,
            @RequestHeader("groupId") String groupId,
            @RequestHeader("tenantId") String tenantId) {
        try {
            CampaignContributionResponse response = contributionService.processContribution(
                    request, memberId, groupId, tenantId);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Payment failed: " + e.getMessage());
        }
    }

    /**
     * Get all contributions for a specific campaign
     * GET /api/volunteer-contributions/campaign/{campaignId}
     */
    @GetMapping("/campaign/{campaignId}")
    public ResponseEntity<?> getCampaignContributions(@PathVariable String campaignId) {
        try {
            return ResponseEntity.ok(contributionService.getCampaignContributions(campaignId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    /**
     * Get member's contributions to volunteer campaigns
     * GET /api/volunteer-contributions/member/{memberId}
     */
    @GetMapping("/member/{memberId}")
    public ResponseEntity<?> getMemberVolunteerContributions(@PathVariable String memberId) {
        try {
            return ResponseEntity.ok(contributionService.getMemberVolunteerContributions(memberId));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error fetching contributions: " + e.getMessage());
        }
    }
}