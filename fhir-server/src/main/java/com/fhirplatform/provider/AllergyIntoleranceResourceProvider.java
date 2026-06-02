package com.fhirplatform.provider;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.annotation.OptionalParam;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.param.ReferenceParam;
import com.fhirplatform.repository.FhirResourceRepository;
import org.hl7.fhir.r4.model.AllergyIntolerance;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class AllergyIntoleranceResourceProvider extends BaseMongoResourceProvider<AllergyIntolerance> {

    public AllergyIntoleranceResourceProvider(FhirResourceRepository repository, FhirContext fhirContext) {
        super(repository, fhirContext);
    }

    @Override
    public String getResourceTypeName() {
        return "AllergyIntolerance";
    }

    @Override
    public Class<AllergyIntolerance> getResourceClass() {
        return AllergyIntolerance.class;
    }

    @Search
    public List<AllergyIntolerance> searchAllergyIntolerances(
            @OptionalParam(name = AllergyIntolerance.SP_PATIENT) ReferenceParam patient) {

        Query query = new Query();

        if (patient != null) {
            query.addCriteria(Criteria.where("content.patient.reference").regex("Patient/" + patient.getIdPart()));
        }

        return repository.findByQuery(query, collectionName())
                .stream()
                .map(this::deserialize)
                .collect(Collectors.toList());
    }
}
