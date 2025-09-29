package com.manpower.service;

import com.manpower.entity.Loan;
import com.manpower.entity.Member;
import com.manpower.entity.Group;
import com.manpower.repository.LoanRepository;
import com.manpower.repository.MemberRepository;
import com.manpower.repository.GroupRepository;
import com.manpower.enums.MemberRole;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.persistence.EntityNotFoundException;
import java.util.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

@Service
public class LoanService {

    @Autowired
    private LoanRepository loanRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private GroupRepository groupRepository;

    public List<Loan> getAllLoans() {
        return loanRepository.findAll();
    }

    public Optional<Loan> getLoanById(String id) {
        return loanRepository.findById(id);
    }

    public Loan saveLoan(Loan loan) {
        // 1. Validate and assign member
        if (loan.getMember() == null || loan.getMember().getId() == null || loan.getMember().getId().trim().isEmpty()) {
            throw new IllegalArgumentException("Loan applicant member ID is required.");
        }
        Member applicantMember = memberRepository.findById(loan.getMember().getId())
                .orElseThrow(() -> new EntityNotFoundException("Loan applicant member with ID " + loan.getMember().getId() + " not found."));
        loan.setMember(applicantMember);

        // 2. Validate and assign group
        if (loan.getGroup() == null || loan.getGroup().getId() == null || loan.getGroup().getId().trim().isEmpty()) {
            throw new IllegalArgumentException("Loan group ID is required.");
        }
        Group loanGroup = groupRepository.findById(loan.getGroup().getId())
                .orElseThrow(() -> new EntityNotFoundException("Loan group with ID " + loan.getGroup().getId() + " not found."));
        loan.setGroup(loanGroup);

        // 3. Set 'approvedBy' logic
        if (loan.getId() == null && "PENDING".equalsIgnoreCase(loan.getStatus())) {
            Set<Member> groupMembers = loanGroup.getMembers();
            if (groupMembers == null || groupMembers.isEmpty()) {
                throw new EntityNotFoundException("No members found in group ID " + loanGroup.getId() + ". Cannot assign an admin for pending loan.");
            }

            Member groupAdmin = groupMembers.stream()
                    .filter(member -> MemberRole.GroupAdmin.equals(member.getRole()))
                    .findFirst()
                    .orElseThrow(() -> new EntityNotFoundException("No member with '" + MemberRole.GroupAdmin.name() + "' role found in group ID " + loanGroup.getId() + ". Cannot assign an admin for pending loan."));

            Member actualGroupAdmin = memberRepository.findById(groupAdmin.getId())
                    .orElseThrow(() -> new EntityNotFoundException("Group admin member with ID " + groupAdmin.getId() + " found in group but not found in database (unexpected)."));

            loan.setApprovedBy(actualGroupAdmin);
        } else if (loan.getApprovedBy() != null && loan.getApprovedBy().getId() != null && !loan.getApprovedBy().getId().trim().isEmpty()) {
            Member explicitApprovedByMember = memberRepository.findById(loan.getApprovedBy().getId())
                    .orElseThrow(() -> new EntityNotFoundException("Approved by member with ID " + loan.getApprovedBy().getId() + " not found."));
            loan.setApprovedBy(explicitApprovedByMember);
        } else {
            throw new IllegalArgumentException("Approved by member is required and cannot be null for loan status " + loan.getStatus() + " or for existing loans.");
        }

        // 4. Calculate interest and balances
        BigDecimal principal;
        if (loan.getAmount() instanceof BigDecimal) {
            principal = (BigDecimal) loan.getAmount();
        } else if (loan.getAmount() instanceof Number) {
            principal = BigDecimal.valueOf(((Number) loan.getAmount()).doubleValue());
        } else {
            throw new IllegalArgumentException("Loan amount must be a numeric type or BigDecimal.");
        }
        BigDecimal annualRate = loan.getInterestRate();
        BigDecimal monthlyRate = annualRate.divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP)
                .divide(BigDecimal.valueOf(12), 6, RoundingMode.HALF_UP);

        LocalDate start = loan.getStartDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        LocalDate end = loan.getDueDate().toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
        long months = ChronoUnit.MONTHS.between(start, end);

        if (months <= 0) {
            throw new IllegalArgumentException("Due date must be at least 1 month after start date.");
        }

        BigDecimal interest = principal.multiply(monthlyRate).multiply(BigDecimal.valueOf(months)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalRepayable = principal.add(interest);

        loan.setCalculatedInterest(interest);
        loan.setOutstandingBalance(totalRepayable);
        
        // Ensure totalPaid is initialized to zero for a new loan
        if (loan.getId() == null || loan.getId().trim().isEmpty()) {
            loan.setTotalPaid(BigDecimal.ZERO);
        }

        // 5. Set metadata
        if (loan.getId() == null || loan.getId().trim().isEmpty()) {
            loan.setId(UUID.randomUUID().toString());
        }

        if (loan.getCreatedOn() == null) {
            loan.setCreatedOn(new Date());
        }

        loan.setModifiedOn(new Date());

        return loanRepository.save(loan);
    }
    
    /**
     * This is the new method to process a payment for a loan.
     * It updates both the totalPaid and outstandingBalance fields.
     */
    public Loan processPayment(String loanId, BigDecimal paymentAmount) {
        if (paymentAmount == null || paymentAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Payment amount must be a positive value.");
        }

        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new EntityNotFoundException("Loan with ID " + loanId + " not found."));

        // Add the new payment to the totalPaid amount
        BigDecimal currentTotalPaid = loan.getTotalPaid();
        BigDecimal newTotalPaid = currentTotalPaid.add(paymentAmount);
        loan.setTotalPaid(newTotalPaid);

        // Subtract the payment from the outstanding balance
        BigDecimal currentOutstandingBalance = loan.getOutstandingBalance();
        BigDecimal newOutstandingBalance = currentOutstandingBalance.subtract(paymentAmount);
        
        // Ensure the outstanding balance doesn't go below zero
        if (newOutstandingBalance.compareTo(BigDecimal.ZERO) < 0) {
            newOutstandingBalance = BigDecimal.ZERO;
        }
        
        loan.setOutstandingBalance(newOutstandingBalance);

        // Update the loan status if it's fully paid
        if (newOutstandingBalance.compareTo(BigDecimal.ZERO) == 0) {
            loan.setStatus("PAID");
        } else if ("PAID".equalsIgnoreCase(loan.getStatus())) {
             // If a payment is made on a loan that was already fully paid,
             // it should be changed to 'PARTIALLY_PAID' or similar
             // You may need to add a new status or adjust this logic as needed.
             // For now, we'll assume it's a minor overpayment and keep the PAID status.
        }


        loan.setModifiedOn(new Date());

        return loanRepository.save(loan);
    }
    
    public Loan approveLoan(String loanId, String approverMemberId) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new EntityNotFoundException("Loan with ID " + loanId + " not found."));

        if (!"PENDING".equalsIgnoreCase(loan.getStatus())) {
            throw new IllegalArgumentException("Only PENDING loans can be approved. Current status: " + loan.getStatus());
        }

        Member actualApprover = memberRepository.findById(approverMemberId)
                .orElseThrow(() -> new EntityNotFoundException("Approving member with ID " + approverMemberId + " not found."));

        if (loan.getApprovedBy() == null || !loan.getApprovedBy().getId().equals(approverMemberId) || !MemberRole.GroupAdmin.equals(actualApprover.getRole())) {
            throw new SecurityException("Unauthorized: Only the assigned group admin with " + MemberRole.GroupAdmin.name() + " role can approve this loan.");
        }

        loan.setStatus("APPROVED");
        loan.setModifiedBy(actualApprover.getId());
        loan.setModifiedOn(new Date());

        return loanRepository.save(loan);
    }

    public Loan rejectLoan(String loanId, String rejecterMemberId) {
        Loan loan = loanRepository.findById(loanId)
                .orElseThrow(() -> new EntityNotFoundException("Loan with ID " + loanId + " not found."));

        if (!"PENDING".equalsIgnoreCase(loan.getStatus())) {
            throw new IllegalArgumentException("Only PENDING loans can be rejected. Current status: " + loan.getStatus());
        }

        Member actualRejecter = memberRepository.findById(rejecterMemberId)
                .orElseThrow(() -> new EntityNotFoundException("Rejecting member with ID " + rejecterMemberId + " not found."));

        if (loan.getApprovedBy() == null || !loan.getApprovedBy().getId().equals(rejecterMemberId) || !MemberRole.GroupAdmin.equals(actualRejecter.getRole())) {
            throw new SecurityException("Unauthorized: Only the assigned group admin with " + MemberRole.GroupAdmin.name() + " role can reject this loan.");
        }

        loan.setStatus("REJECTED");
        loan.setModifiedBy(actualRejecter.getId());
        loan.setModifiedOn(new Date());

        return loanRepository.save(loan);
    }

    public void deleteLoan(String id) {
        loanRepository.deleteById(id);
    }
}