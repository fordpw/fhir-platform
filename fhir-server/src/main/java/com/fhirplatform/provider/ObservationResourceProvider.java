package com.fhirplatform.provider;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.annotation.OptionalParam;
import ca.uhn.fhir.rest.annotation.Count;
import ca.uhn.fhir.rest.annotation.Offset;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.api.server.IBundleProvider;
import ca.uhn.fhir.rest.param.DateParam;
import ca.uhn.fhir.rest.param.ReferenceParam;
import ca.uhn.fhir.rest.param.TokenParam;
import com.fhirplatform.repository.FhirResourceRepository;
import org.hl7.fhir.r4.model.Observation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class ObservationResourceProvider extends BaseMongoResourceProvider<Observation> {

    public ObservationResourceProvider(FhirResourceRepository repository, FhirContext fhirContext) {
        super(repository, fhirContext);
    }

    @Override
    public String getResourceTypeName() {
        return "Observation";
    }

    @Override
    public Class<Observation> getResourceClass() {
        return Observation.class;
    }

    @Search
    public IBundleProvider searchObservations(
            @OptionalParam(name = Observation.SP_PATIENT) ReferenceParam patient,
            @OptionalParam(name = Observation.SP_CODE) TokenParam code,
            @OptionalParam(name = Observation.SP_DATE) DateParam date,
            @OptionalParam(name = Observation.SP_CATEGORY) TokenParam category,
            @Count Integer count,
            @Offset Integer offset) {

        Query query = new Query();

        if (patient != null) {
            query.addCriteria(Criteria.where("content.subject.reference").regex("Patient/" + patient.getIdPart()));
        }
        if (code != null) {
            query.addCriteria(Criteria.where("content.code.coding.code").is(code.getValue()));
        }
        if (date != null) {
            query.addCriteria(Criteria.where("content.effectiveDateTime").regex(date.getValueAsString()));
        }
        if (category != null) {
            query.addCriteria(Criteria.where("content.category.coding.code").is(category.getValue()));
        }

        return page(query, count, offset);
    }
}
