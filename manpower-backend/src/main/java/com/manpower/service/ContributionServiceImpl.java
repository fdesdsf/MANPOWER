package com.manpower.service;

import com.manpower.entity.Contribution;
import com.manpower.entity.Group;
import com.manpower.entity.Member;
import com.manpower.repository.ContributionRepository;
import com.manpower.repository.GroupRepository;
import com.manpower.repository.MemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
public class ContributionServiceImpl implements ContributionService {

    @Autowired
    private ContributionRepository contributionRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private GroupRepository groupRepository;

    @Override
    @Transactional
    public Contribution saveContribution(Contribution contribution) {
        if (contribution.getMember() == null || contribution.getMember().getId() == null) {
            throw new IllegalArgumentException("Contribution must be associated with a member (ID cannot be null).");
        }
        if (contribution.getGroup() == null || contribution.getGroup().getId() == null) {
            throw new IllegalArgumentException("Contribution must be associated with a group (ID cannot be null).");
        }

        Optional<Member> memberOpt = memberRepository.findById(contribution.getMember().getId());
        if (!memberOpt.isPresent()) {
            throw new IllegalArgumentException("Member with ID " + contribution.getMember().getId() + " not found.");
        }

        Optional<Group> groupOpt = groupRepository.findById(contribution.getGroup().getId());
        if (!groupOpt.isPresent()) {
            throw new IllegalArgumentException("Group with ID " + contribution.getGroup().getId() + " not found.");
        }

        contribution.setMember(memberOpt.get());
        contribution.setGroup(groupOpt.get());

        return contributionRepository.save(contribution);
    }

    @Override
    public List<Contribution> getAllContributions() {
        return contributionRepository.findAll();
    }

    @Override
    public Optional<Contribution> getContributionById(String id) {
        return contributionRepository.findById(id);
    }

    @Override
    public List<Contribution> getContributionsByMemberId(String memberId) {
        if (!memberRepository.existsById(memberId)) {
            throw new IllegalArgumentException("Member with ID " + memberId + " not found.");
        }
        return contributionRepository.findByMemberId(memberId);
    }

    @Override
    public List<Contribution> getContributionsByGroupId(String groupId) {
        if (!groupRepository.existsById(groupId)) {
            throw new IllegalArgumentException("Group with ID " + groupId + " not found.");
        }
        return contributionRepository.findByGroupId(groupId);
    }

    @Override
    @Transactional
    public void deleteContribution(String id) {
        if (!contributionRepository.existsById(id)) {
            throw new IllegalArgumentException("Contribution with ID " + id + " not found.");
        }
        contributionRepository.deleteById(id);
    }

    @Override
    public Map<String, Object> getContributionSummary(String groupId) {
        List<Contribution> contributions;

        if (groupId != null && !groupId.isEmpty()) {
            if (!groupRepository.existsById(groupId)) {
                throw new IllegalArgumentException("Group with ID " + groupId + " not found.");
            }
            contributions = contributionRepository.findByGroupId(groupId);
        } else {
            contributions = contributionRepository.findAll();
        }

        double total = contributions.stream()
                .mapToDouble(c -> c.getAmount().doubleValue())
                .sum();

        Map<String, Object> summary = new HashMap<>();
        summary.put("groupId", groupId);
        summary.put("totalContributions", total);
        summary.put("numberOfContributions", contributions.size());

        return summary;
    }

    // ✅ NEW: Total contribution amount by group ID
    @Override
    public BigDecimal getTotalContributionsByGroup(String groupId) {
        if (!groupRepository.existsById(groupId)) {
            throw new IllegalArgumentException("Group with ID " + groupId + " not found.");
        }
        return contributionRepository.sumByGroupId(groupId);
    }
}
