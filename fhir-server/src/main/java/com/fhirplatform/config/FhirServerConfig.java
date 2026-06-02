package com.fhirplatform.config;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.server.RestfulServer;
import ca.uhn.fhir.rest.server.interceptor.CorsInterceptor;
import ca.uhn.fhir.rest.server.IResourceProvider;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;

import java.util.Arrays;
import java.util.List;

@Configuration
public class FhirServerConfig {

    @Bean
    public FhirContext fhirContext() {
        return FhirContext.forR4();
    }

    @Bean
    public ServletRegistrationBean<RestfulServer> fhirServletRegistration(
            FhirContext fhirContext,
            List<IResourceProvider> resourceProviders) {

        RestfulServer restfulServer = new RestfulServer(fhirContext);
        restfulServer.setDefaultResponseEncoding(ca.uhn.fhir.rest.api.EncodingEnum.JSON);
        restfulServer.setResourceProviders(resourceProviders);
        restfulServer.setServerName("FHIR R4 Healthcare Platform");
        restfulServer.setServerVersion("1.0.0");

        CorsConfiguration corsConfig = new CorsConfiguration();
        corsConfig.setAllowedOrigins(List.of("http://localhost:5173"));
        corsConfig.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        corsConfig.setAllowedHeaders(List.of("*"));
        corsConfig.setAllowCredentials(true);

        CorsInterceptor corsInterceptor = new CorsInterceptor(corsConfig);
        restfulServer.registerInterceptor(corsInterceptor);

        ServletRegistrationBean<RestfulServer> registration = new ServletRegistrationBean<>(restfulServer, "/fhir/*");
        registration.setName("FhirServlet");
        registration.setLoadOnStartup(1);
        return registration;
    }
}
