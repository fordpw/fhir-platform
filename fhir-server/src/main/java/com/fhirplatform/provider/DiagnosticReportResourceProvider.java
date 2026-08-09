package com.fhirplatform.provider;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.annotation.OptionalParam;
import ca.uhn.fhir.rest.annotation.Count;
import ca.uhn.fhir.rest.annotation.Offset;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.api.server.IBundleProvider;
import ca.uhn.fhir.rest.param.ReferenceParam;
import ca.uhn.fhir.rest.param.TokenParam;
import com.fhirplatform.repository.FhirResourceRepository;
import org.hl7.fhir.r4.model.DiagnosticReport;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class DiagnosticReportResourceProvider extends BaseMongoResourceProvider<DiagnosticReport> {

    public DiagnosticReportResourceProvider(FhirResourceRepository repository, FhirContext fhirContext) {
        super(repository, fhirContext);
    }

    @Override
    public String getResourceTypeName() {
        return "DiagnosticReport";
    }

    @Override
    public Class<DiagnosticReport> getResourceClass() {
        return DiagnosticReport.class;
    }

    @Search
    public IBundleProvider searchDiagnosticReports(
            @OptionalParam(name = DiagnosticReport.SP_PATIENT) ReferenceParam patient,
            @OptionalParam(name = DiagnosticReport.SP_CODE) TokenParam code,
            @Count Integer count,
            @Offset Integer offset) {

        Query query = new Query();

        if (patient != null) {
            query.addCriteria(Criteria.where("content.subject.reference").regex("Patient/" + patient.getIdPart()));
        }
        if (code != null) {
            query.addCriteria(Criteria.where("content.code.coding.code").is(code.getValue()));
        }

        return page(query, count, offset);
    }
}
