package com.fhirplatform.provider;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.annotation.OptionalParam;
import ca.uhn.fhir.rest.annotation.Count;
import ca.uhn.fhir.rest.annotation.Offset;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.api.server.IBundleProvider;
import ca.uhn.fhir.rest.param.ReferenceParam;
import com.fhirplatform.repository.FhirResourceRepository;
import org.hl7.fhir.r4.model.Coverage;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class CoverageResourceProvider extends BaseMongoResourceProvider<Coverage> {

    public CoverageResourceProvider(FhirResourceRepository repository, FhirContext fhirContext) {
        super(repository, fhirContext);
    }

    @Override
    public String getResourceTypeName() {
        return "Coverage";
    }

    @Override
    public Class<Coverage> getResourceClass() {
        return Coverage.class;
    }

    @Search
    public IBundleProvider searchCoverages(
            @OptionalParam(name = Coverage.SP_BENEFICIARY) ReferenceParam beneficiary,
            @Count Integer count,
            @Offset Integer offset) {

        Query query = new Query();

        if (beneficiary != null) {
            query.addCriteria(Criteria.where("content.beneficiary.reference").regex("Patient/" + beneficiary.getIdPart()));
        }

        return page(query, count, offset);
    }
}
