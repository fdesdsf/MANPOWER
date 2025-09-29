package com.manpower.entity;

import javax.persistence.*;
import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Date;

@Entity
@Table(name = "loans")
public class Loan implements Serializable {

    @Id
    @Column(name = "id", nullable = false, length = 40)
    private String id;

    @ManyToOne
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @Column(name = "amount", nullable = false)
    private BigDecimal amount;

    @Column(name = "interestRate")
    private BigDecimal interestRate;

    // A new field to store the calculated interest amount
    @Column(name = "calculated_interest")
    private BigDecimal calculatedInterest;

    @Column(name = "startDate")
    @Temporal(TemporalType.DATE)
    private Date startDate;

    @Column(name = "dueDate")
    @Temporal(TemporalType.DATE)
    private Date dueDate;

    @Column(name = "status", length = 50)
    private String status;

    @Column(name = "outstandingBalance")
    private BigDecimal outstandingBalance;

    // New field to track the total amount paid
    @Column(name = "total_paid")
    private BigDecimal totalPaid = BigDecimal.ZERO;

    @ManyToOne
    @JoinColumn(name = "approvedBy_member_id", nullable = false)
    private Member approvedBy;

    @Column(name = "created_by", length = 40)
    private String createdBy;

    @Column(name = "modified_by", length = 40)
    private String modifiedBy;

    @Column(name = "created_on", updatable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdOn = new Date();

    @Column(name = "modified_on")
    @Temporal(TemporalType.TIMESTAMP)
    private Date modifiedOn = new Date();

    @Column(name = "mansoft_tenant_id", length = 100)
    private String mansoftTenantId;

    // New field to store the reason for the loan
    @Column(name = "reason", length = 255)
    private String reason;

    // Getters and Setters

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Member getMember() {
        return member;
    }

    public void setMember(Member member) {
        this.member = member;
    }

    public Group getGroup() {
        return group;
    }

    public void setGroup(Group group) {
        this.group = group;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public BigDecimal getInterestRate() {
        return interestRate;
    }

    public void setInterestRate(BigDecimal interestRate) {
        this.interestRate = interestRate;
    }

    public BigDecimal getCalculatedInterest() {
        return calculatedInterest;
    }

    public void setCalculatedInterest(BigDecimal calculatedInterest) {
        this.calculatedInterest = calculatedInterest;
    }

    public Date getStartDate() {
        return startDate;
    }

    public void setStartDate(Date startDate) {
        this.startDate = startDate;
    }

    public Date getDueDate() {
        return dueDate;
    }

    public void setDueDate(Date dueDate) {
        this.dueDate = dueDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public BigDecimal getOutstandingBalance() {
        return outstandingBalance;
    }

    public void setOutstandingBalance(BigDecimal outstandingBalance) {
        this.outstandingBalance = outstandingBalance;
    }

    public BigDecimal getTotalPaid() {
        return totalPaid;
    }

    public void setTotalPaid(BigDecimal totalPaid) {
        this.totalPaid = totalPaid;
    }

    public Member getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(Member approvedBy) {
        this.approvedBy = approvedBy;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getModifiedBy() {
        return modifiedBy;
    }

    public void setModifiedBy(String modifiedBy) {
        this.modifiedBy = modifiedBy;
    }

    public Date getCreatedOn() {
        return createdOn;
    }

    public void setCreatedOn(Date createdOn) {
        this.createdOn = createdOn;
    }

    public Date getModifiedOn() {
        return modifiedOn;
    }

    public void setModifiedOn(Date modifiedOn) {
        this.modifiedOn = modifiedOn;
    }

    public String getMansoftTenantId() {
        return mansoftTenantId;
    }

    public void setMansoftTenantId(String mansoftTenantId) {
        this.mansoftTenantId = mansoftTenantId;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
