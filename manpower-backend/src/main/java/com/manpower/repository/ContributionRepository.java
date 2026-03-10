package com.manpower.repository;

import com.manpower.entity.Contribution;
import com.manpower.entity.Member;
import com.manpower.enums.TransactionType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface ContributionRepository extends JpaRepository<Contribution, String> {

    List<Contribution> findByMember(Member member);

    List<Contribution> findByMemberId(String memberId);

    List<Contribution> findByGroupId(String groupId);

    // Add this method
    List<Contribution> findByVolunteerCampaignId(String campaignId);

// Add this method
    List<Contribution> findByMemberIdAndTransactionType(String memberId, TransactionType transactionType);

    // ✅ NEW: Sum total contribution amount by group ID
    @Query("SELECT COALESCE(SUM(c.amount), 0) FROM Contribution c WHERE c.group.id = :groupId")
    BigDecimal sumByGroupId(@Param("groupId") String groupId);

    // 👇 ADD THIS NEW METHOD HERE (BEFORE THE CLOSING BRACE)
    @Query("SELECT COALESCE(SUM(c.amount), 0), COUNT(DISTINCT c.member.id), COUNT(c.id) " +
           "FROM Contribution c WHERE c.volunteerCampaign.id = :campaignId AND c.status = 'Completed'")
    Object[] getVolunteerCampaignStats(@Param("campaignId") String campaignId);
}
