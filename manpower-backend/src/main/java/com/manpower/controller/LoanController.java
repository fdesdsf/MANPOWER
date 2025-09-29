// ✅ LOAN CONTROLLER
package com.manpower.controller;

import com.manpower.entity.Loan;
import com.manpower.service.LoanService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.Map;

@CrossOrigin(origins = {"http://localhost:8081", "http://192.168.0.103:8081"})
@RestController
@RequestMapping("/api/loans")
public class LoanController {

    @Autowired
    private LoanService loanService;

    @Operation(summary = "Create a loan")
    @PostMapping
    public Loan create(@RequestBody Loan loan) {
        if (loan.getId() == null || loan.getId().trim().isEmpty()) {
            loan.setId(UUID.randomUUID().toString());
        }
        return loanService.saveLoan(loan);
    }

    @Operation(summary = "Get all loans")
    @GetMapping
    public List<Loan> getAll() {
        return loanService.getAllLoans();
    }

    @Operation(summary = "Get loan by ID")
    @GetMapping("/{id}")
    public Optional<Loan> getById(@PathVariable String id) {
        return loanService.getLoanById(id);
    }

    @Operation(summary = "Update a loan")
    @PutMapping("/{id}")
    public Loan update(@PathVariable String id, @RequestBody Loan loan) {
        loan.setId(id);
        return loanService.saveLoan(loan);
    }

    @Operation(summary = "Delete a loan")
    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        loanService.deleteLoan(id);
    }

    /**
     * Endpoint to process a payment for a specific loan.
     * This is the new method you need.
     */
    @Operation(summary = "Process a payment for a loan")
    @PostMapping("/{loanId}/pay")
    public ResponseEntity<Loan> processPayment(@PathVariable String loanId, @RequestBody Map<String, Object> payload) {
        try {
            if (!payload.containsKey("paymentAmount") || payload.get("paymentAmount") == null) {
                return ResponseEntity.badRequest().body(null);
            }

            BigDecimal paymentAmount;
            Object amount = payload.get("paymentAmount");
            if (amount instanceof Number) {
                paymentAmount = BigDecimal.valueOf(((Number) amount).doubleValue());
            } else {
                return ResponseEntity.badRequest().body(null);
            }

            Loan updatedLoan = loanService.processPayment(loanId, paymentAmount);
            return ResponseEntity.ok(updatedLoan);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(null);
        }
    }
}