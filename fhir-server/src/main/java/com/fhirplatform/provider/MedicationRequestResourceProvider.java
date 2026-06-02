package com.fhirplatform.provider;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.annotation.OptionalParam;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.param.ReferenceParam;
import ca.uhn.fhir.rest.param.TokenParam;
import com.fhirplatform.repository.FhirResourceRepository;
import org.hl7.fhir.r4.model.MedicationRequest;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class MedicationRequestResourceProvider extends BaseMongoResourceProvider<MedicationRequest> {

    public MedicationRequestResourceProvider(FhirResourceRepository repository, FhirContext fhirContext) {
        super(repository, fhirContext);
    }

    @Override
    public String getResourceTypeName() {
        return "MedicationRequest";
    }

    @Override
    public Class<MedicationRequest> getResourceClass() {
        return MedicationRequest.class;
    }

    @Search
    public List<MedicationRequest> searchMedicationRequests(
            @OptionalParam(name = MedicationRequest.SP_PATIENT) ReferenceParam patient,
            @OptionalParam(name = MedicationRequest.SP_STATUS) TokenParam status) {

        Query query = new Query();

        if (patient != null) {
            query.addCriteria(Criteria.where("content.subject.reference").regex("Patient/" + patient.getIdPart()));
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
