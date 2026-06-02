package com.fhirplatform.provider;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.annotation.OptionalParam;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.param.DateParam;
import ca.uhn.fhir.rest.param.ReferenceParam;
import com.fhirplatform.repository.FhirResourceRepository;
import org.hl7.fhir.r4.model.Immunization;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class ImmunizationResourceProvider extends BaseMongoResourceProvider<Immunization> {

    public ImmunizationResourceProvider(FhirResourceRepository repository, FhirContext fhirContext) {
        super(repository, fhirContext);
    }

    @Override
    public String getResourceTypeName() {
        return "Immunization";
    }

    @Override
    public Class<Immunization> getResourceClass() {
        return Immunization.class;
    }

    @Search
    public List<Immunization> searchImmunizations(
            @OptionalParam(name = Immunization.SP_PATIENT) ReferenceParam patient,
            @OptionalParam(name = Immunization.SP_DATE) DateParam date) {

        Query query = new Query();

        if (patient != null) {
            query.addCriteria(Criteria.where("content.patient.reference").regex("Patient/" + patient.getIdPart()));
        }
        if (date != null) {
            query.addCriteria(Criteria.where("content.occurrenceDateTime").regex(date.getValueAsString()));
        }

        return repository.findByQuery(query, collectionName())
                .stream()
                .map(this::deserialize)
                .collect(Collectors.toList());
    }
}
