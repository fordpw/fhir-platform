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
import org.hl7.fhir.r4.model.CarePlan;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class CarePlanResourceProvider extends BaseMongoResourceProvider<CarePlan> {

    public CarePlanResourceProvider(FhirResourceRepository repository, FhirContext fhirContext) {
        super(repository, fhirContext);
    }

    @Override
    public String getResourceTypeName() {
        return "CarePlan";
    }

    @Override
    public Class<CarePlan> getResourceClass() {
        return CarePlan.class;
    }

    @Search
    public IBundleProvider searchCarePlans(
            @OptionalParam(name = CarePlan.SP_PATIENT) ReferenceParam patient,
            @OptionalParam(name = CarePlan.SP_STATUS) TokenParam status,
            @Count Integer count,
            @Offset Integer offset) {

        Query query = new Query();

        if (patient != null) {
            query.addCriteria(Criteria.where("content.subject.reference").regex("Patient/" + patient.getIdPart()));
        }
        if (status != null) {
            query.addCriteria(Criteria.where("content.status").is(status.getValue()));
        }

        return page(query, count, offset);
    }
}
