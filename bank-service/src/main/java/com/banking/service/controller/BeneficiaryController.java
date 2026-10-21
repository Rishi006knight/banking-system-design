package com.banking.service.controller;

import com.banking.service.dto.BeneficiaryDto;
import com.banking.service.service.BeneficiaryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/beneficiaries")
public class BeneficiaryController {

    private final BeneficiaryService beneficiaryService;

    public BeneficiaryController(BeneficiaryService beneficiaryService) {
        this.beneficiaryService = beneficiaryService;
    }

    @GetMapping
    public ResponseEntity<List<BeneficiaryDto>> getBeneficiaries(@RequestParam("customerId") String customerId) {
        return ResponseEntity.ok(beneficiaryService.getBeneficiaries(customerId));
    }

    @PostMapping
    public ResponseEntity<BeneficiaryDto> addBeneficiary(
            @RequestParam("customerId") String customerId,
            @Valid @RequestBody BeneficiaryDto dto) {
        BeneficiaryDto created = beneficiaryService.addBeneficiary(customerId, dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
