package com.banking.service.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class HeaderResponseFilter implements Filter {

    @Value("${banking.node-id:1}")
    private long nodeId;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (response instanceof HttpServletResponse httpResponse) {
            httpResponse.setHeader("X-Served-By", "bank-service-" + nodeId);
        }
        chain.doFilter(request, response);
    }
}
