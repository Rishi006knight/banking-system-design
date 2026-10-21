package com.banking.baseline;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = BaselineApplication.class, properties = {
        "baseline.db-path=./target/baseline-test.db"
})
@AutoConfigureMockMvc
class BaselineIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Test Baseline Registration, Login, and Transfer")
    void testBaselineWorkflows() throws Exception {
        String suffix = String.valueOf(System.currentTimeMillis() % 1000000);
        String alice = "alice_base_" + suffix;
        String bob = "bob_base_" + suffix;

        // 1. Register Alice
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + alice + "\",\"password\":\"pass123\",\"email\":\"alice@b.com\",\"fullName\":\"Alice\",\"initialDepositCents\":50000}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.primaryAccountId").exists());

        // 2. Register Bob
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + bob + "\",\"password\":\"pass123\",\"email\":\"bob@b.com\",\"fullName\":\"Bob\",\"initialDepositCents\":20000}"))
                .andExpect(status().isCreated());

        // 3. Login Alice
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + alice + "\",\"password\":\"pass123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists());
    }
}
