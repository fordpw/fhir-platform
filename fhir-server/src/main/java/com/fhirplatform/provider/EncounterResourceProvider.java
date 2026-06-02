package com.fhirplatform.provider;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.annotation.OptionalParam;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.param.DateParam;
import ca.uhn.fhir.rest.param.ReferenceParam;
import ca.uhn.fhir.rest.param.TokenParam;
import com.fhirplatform.repository.FhirResourceRepository;
import org.hl7.fhir.r4.model.Encounter;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class EncounterResourceProvider extends BaseMongoResourceProvider<Encounter> {

    public EncounterResourceProvider(FhirResourceRepository repository, FhirContext fhirContext) {
        super(repository, fhirContext);
    }

    @Override
    public String getResourceTypeName() {
        return "Encounter";
    }

    @Override
    public Class<Encounter> getResourceClass() {
        return Encounter.class;
    }

    @Search
    public List<Encounter> searchEncounters(
            @OptionalParam(name = Encounter.SP_PATIENT) ReferenceParam patient,
            @OptionalParam(name = Encounter.SP_DATE) DateParam date,
            @OptionalParam(name = Encounter.SP_STATUS) TokenParam status) {

        Query query = new Query();

        if (patient != null) {
            query.addCriteria(Criteria.where("content.subject.reference").regex("Patient/" + patient.getIdPart()));
        }
        if (date != null) {
            query.addCriteria(Criteria.where("content.period.start").regex(date.getValueAsString()));
        }
        if (status != null) {
            query.addCriteria(Criteria.where("content.status").is(status.getValue()));
        }

        return repository.findByQuery(query, collectionName())
                .stream()
                .map(this::deserialize)
                .collect(Collectors.toList());
    }
}
