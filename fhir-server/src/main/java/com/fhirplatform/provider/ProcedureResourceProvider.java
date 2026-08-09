package com.fhirplatform.provider;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.annotation.OptionalParam;
import ca.uhn.fhir.rest.annotation.Count;
import ca.uhn.fhir.rest.annotation.Offset;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.api.server.IBundleProvider;
import ca.uhn.fhir.rest.param.DateParam;
import ca.uhn.fhir.rest.param.ReferenceParam;
import com.fhirplatform.repository.FhirResourceRepository;
import org.hl7.fhir.r4.model.Procedure;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class ProcedureResourceProvider extends BaseMongoResourceProvider<Procedure> {

    public ProcedureResourceProvider(FhirResourceRepository repository, FhirContext fhirContext) {
        super(repository, fhirContext);
    }

    @Override
    public String getResourceTypeName() {
        return "Procedure";
    }

    @Override
    public Class<Procedure> getResourceClass() {
        return Procedure.class;
    }

    @Search
    public IBundleProvider searchProcedures(
            @OptionalParam(name = Procedure.SP_PATIENT) ReferenceParam patient,
            @OptionalParam(name = Procedure.SP_DATE) DateParam date,
            @Count Integer count,
            @Offset Integer offset) {

        Query query = new Query();

        if (patient != null) {
            query.addCriteria(Criteria.where("content.subject.reference").regex("Patient/" + patient.getIdPart()));
        }
        if (date != null) {
            query.addCriteria(Criteria.where("content.performedDateTime").regex(date.getValueAsString()));
        }

        return page(query, count, offset);
    }
}
