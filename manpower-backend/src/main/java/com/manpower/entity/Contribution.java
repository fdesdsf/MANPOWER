package com.manpower.entity;

import com.manpower.enums.TransactionType;
import com.manpower.enums.TransactionStatus;
import org.hibernate.annotations.GenericGenerator; // For UUID generation
import org.hibernate.annotations.CreationTimestamp; // For automatic creation timestamp
import org.hibernate.annotations.UpdateTimestamp;   // For automatic update timestamp

import javax.persistence.*;
import javax.validation.constraints.DecimalMin; // For amount validation
import javax.validation.constraints.NotBlank;  // For String fields
import javax.validation.constraints.NotNull;   // For non-null fields
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;     // Use modern Java Date/Time API
import java.time.LocalDateTime; // Use modern Java Date/Time API

@Entity
@Table(name = "contributions")
public class Contribution implements Serializable {

    @Id
    @GeneratedValue(generator = "uuid2") // Configure UUID generation
    @GenericGenerator(name = "uuid2", strategy = "org.hibernate.id.UUIDGenerator")
    @Column(name = "id", nullable = false, length = 40) // UUIDs are typically 36 chars, 40 is safe
    private String id;

    @NotNull(message = "Member cannot be null")
    @ManyToOne(fetch = FetchType.LAZY) // Use LAZY loading to avoid N+1 issues unless explicitly needed
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @NotNull(message = "Group cannot be null")
    @ManyToOne(fetch = FetchType.LAZY) // Use LAZY loading
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @NotNull(message = "Transaction type cannot be null")
    @Enumerated(EnumType.STRING)
    @Column(name = "transactionType", nullable = false, length = 20)
    private TransactionType transactionType;

    @NotNull(message = "Amount cannot be null")
    @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
    @Column(name = "amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @NotNull(message = "Transaction date cannot be null")
    @Column(name = "transactionDate")
    private LocalDate transactionDate; // Changed to LocalDate

    @NotBlank(message = "Payment method cannot be empty")
    @Column(name = "paymentMethod", length = 50)
    private String paymentMethod;

    @NotNull(message = "Status cannot be null")
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20)
    private TransactionStatus status = TransactionStatus.Completed;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @NotBlank(message = "Created by cannot be empty")
    @Column(name = "created_by", length = 40)
    private String createdBy;

    @NotBlank(message = "Modified by cannot be empty")
    @Column(name = "modified_by", length = 40)
    private String modifiedBy;

    @CreationTimestamp // Automatically set creation timestamp
    @Column(name = "created_on", updatable = false)
    private LocalDateTime createdOn; // Changed to LocalDateTime

    @UpdateTimestamp // Automatically update timestamp on modification
    @Column(name = "modified_on")
    private LocalDateTime modifiedOn; // Changed to LocalDateTime

    @NotBlank(message = "Mansoft tenant ID cannot be empty")
    @Column(name = "mansoft_tenant_id", length = 100)
    private String mansoftTenantId;

    // --- Constructors ---
    public Contribution() {
    }

    // You might want a constructor for easier creation
    public Contribution(Member member, Group group, TransactionType transactionType, BigDecimal amount,
                        LocalDate transactionDate, String paymentMethod, String createdBy, String mansoftTenantId) {
        this.member = member;
        this.group = group;
        this.transactionType = transactionType;
        this.amount = amount;
        this.transactionDate = transactionDate;
        this.paymentMethod = paymentMethod;
        this.createdBy = createdBy;
        this.modifiedBy = createdBy; // Initially same as createdBy
        this.mansoftTenantId = mansoftTenantId;
        this.status = TransactionStatus.Completed; // Default status
    }


    // --- Getters and Setters ---
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Member getMember() { return member; }
    public void setMember(Member member) { this.member = member; }

    public Group getGroup() { return group; }
    public void setGroup(Group group) { this.group = group; }

    public TransactionType getTransactionType() { return transactionType; }
    public void setTransactionType(TransactionType transactionType) { this.transactionType = transactionType; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public LocalDate getTransactionDate() { return transactionDate; }
    public void setTransactionDate(LocalDate transactionDate) { this.transactionDate = transactionDate; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public TransactionStatus getStatus() { return status; }
    public void setStatus(TransactionStatus status) { this.status = status; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getModifiedBy() { return modifiedBy; }
    public void setModifiedBy(String modifiedBy) { this.modifiedBy = modifiedBy; }

    public LocalDateTime getCreatedOn() { return createdOn; }
    public void setCreatedOn(LocalDateTime createdOn) { this.createdOn = createdOn; }

    public LocalDateTime getModifiedOn() { return modifiedOn; }
    public void setModifiedOn(LocalDateTime modifiedOn) { this.modifiedOn = modifiedOn; }

    public String getMansoftTenantId() { return mansoftTenantId; }
    public void setMansoftTenantId(String mansoftTenantId) { this.mansoftTenantId = mansoftTenantId; }
}
