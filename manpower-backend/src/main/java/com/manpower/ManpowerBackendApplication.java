package com.manpower;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean; // Import @Bean
import org.springframework.web.client.RestTemplate; // Import RestTemplate

@SpringBootApplication // ✅ This tells Spring Boot to auto-configure everything
public class ManpowerBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(ManpowerBackendApplication.class, args);
        System.out.println("✅ MANPOWER Backend Application Running...");
    }

    /**
     * Defines a RestTemplate bean for making HTTP requests to external APIs.
     * This is required by PesaPalServiceImpl to communicate with the PesaPal API.
     *
     * @return A new instance of RestTemplate.
     */
    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
