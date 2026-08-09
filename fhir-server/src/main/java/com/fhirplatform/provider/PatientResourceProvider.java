package com.fhirplatform.provider;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.annotation.OptionalParam;
import ca.uhn.fhir.rest.annotation.Count;
import ca.uhn.fhir.rest.annotation.Offset;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.api.server.IBundleProvider;
import ca.uhn.fhir.rest.param.DateParam;
import ca.uhn.fhir.rest.param.StringParam;
import ca.uhn.fhir.rest.param.TokenParam;
import com.fhirplatform.model.FhirResourceDocument;
import com.fhirplatform.repository.FhirResourceRepository;
import org.hl7.fhir.r4.model.Patient;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class PatientResourceProvider extends BaseMongoResourceProvider<Patient> {

    public PatientResourceProvider(FhirResourceRepository repository, FhirContext fhirContext) {
        super(repository, fhirContext);
    }

    @Override
    public String getResourceTypeName() {
        return "Patient";
    }

    @Override
    public Class<Patient> getResourceClass() {
        return Patient.class;
    }

    @Search
    public IBundleProvider searchPatients(
            @OptionalParam(name = Patient.SP_FAMILY) StringParam family,
            @OptionalParam(name = Patient.SP_GIVEN) StringParam given,
            @OptionalParam(name = Patient.SP_IDENTIFIER) TokenParam identifier,
            @OptionalParam(name = Patient.SP_BIRTHDATE) DateParam birthdate,
            @Count Integer count,
            @Offset Integer offset) {

        Query query = new Query();

        if (family != null) {
            query.addCriteria(Criteria.where("content.name.family").regex(family.getValue(), "i"));
        }
        if (given != null) {
            query.addCriteria(Criteria.where("content.name.given").regex(given.getValue(), "i"));
        }
        if (identifier != null) {
            Criteria identifierCriteria = Criteria.where("content.identifier.value").is(identifier.getValue());
            if (identifier.getSystem() != null) {
                identifierCriteria = identifierCriteria.and("content.identifier.system").is(identifier.getSystem());
            }
            query.addCriteria(identifierCriteria);
        }
        if (birthdate != null) {
            query.addCriteria(Criteria.where("content.birthDate").is(birthdate.getValueAsString()));
        }

        return page(query, count, offset);
    }
}
