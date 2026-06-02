package com.fhirplatform.provider;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.annotation.OptionalParam;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.param.StringParam;
import ca.uhn.fhir.rest.param.TokenParam;
import com.fhirplatform.repository.FhirResourceRepository;
import org.hl7.fhir.r4.model.Practitioner;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class PractitionerResourceProvider extends BaseMongoResourceProvider<Practitioner> {

    public PractitionerResourceProvider(FhirResourceRepository repository, FhirContext fhirContext) {
        super(repository, fhirContext);
    }

    @Override
    public String getResourceTypeName() {
        return "Practitioner";
    }

    @Override
    public Class<Practitioner> getResourceClass() {
        return Practitioner.class;
    }

    @Search
    public List<Practitioner> searchPractitioners(
            @OptionalParam(name = Practitioner.SP_NAME) StringParam name,
            @OptionalParam(name = Practitioner.SP_IDENTIFIER) TokenParam identifier) {

        Query query = new Query();

        if (name != null) {
            query.addCriteria(new Criteria().orOperator(
                    Criteria.where("content.name.family").regex(name.getValue(), "i"),
                    Criteria.where("content.name.given").regex(name.getValue(), "i")
            ));
        }
        if (identifier != null) {
            query.addCriteria(Criteria.where("content.identifier.value").is(identifier.getValue()));
        }

        return repository.findByQuery(query, collectionName())
                .stream()
                .map(this::deserialize)
                .collect(Collectors.toList());
    }
}
