package com.manpower.controller;

import com.manpower.dto.PesaPalInitiateRequest;
import com.manpower.dto.PesaPalInitiateResponse;
import com.manpower.service.PesaPalService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
@CrossOrigin(origins = "*") // Allows frontend apps to connect (adjust if needed)
public class PaymentController {

    @Autowired
    private PesaPalService pesaPalService;

    /**
     * Initiates a PesaPal payment and returns a redirect URL + tracking ID.
     * Frontend should redirect user to this URL.
     */
    @PostMapping("/initiate")
    public ResponseEntity<?> initiatePayment(@RequestBody PesaPalInitiateRequest request) {
        try {
            PesaPalInitiateResponse response = pesaPalService.initiatePayment(request);
            return ResponseEntity.ok(response); // 200 OK with redirect URL
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Invalid input: " + e.getMessage()); // 400
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                 .body("Failed to initiate payment: " + e.getMessage()); // 500
        }
    }

    /**
     * Checks the status of a PesaPal transaction by order tracking ID.
     * Used after redirect or via polling.
     */
    @GetMapping("/status/{orderTrackingId}")
    public ResponseEntity<String> checkPaymentStatus(@PathVariable String orderTrackingId) {
        try {
            String status = pesaPalService.checkPaymentStatus(orderTrackingId);
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                 .body("Failed to check payment status: " + e.getMessage());
        }
    }
}
