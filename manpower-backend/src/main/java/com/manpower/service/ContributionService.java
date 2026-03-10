package com.manpower.service;

import com.manpower.entity.Contribution;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Map;

public interface ContributionService {
    Contribution saveContribution(Contribution contribution);
    List<Contribution> getAllContributions();
    Optional<Contribution> getContributionById(String id);
    List<Contribution> getContributionsByMemberId(String memberId);
    List<Contribution> getContributionsByGroupId(String groupId);
    void deleteContribution(String id);

    // ✅ Summary endpoint
    Map<String, Object> getContributionSummary(String groupId);

    // ✅ New method: Total contributions by group
    BigDecimal getTotalContributionsByGroup(String groupId);
}
