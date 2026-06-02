package com.fhirplatform.provider;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.annotation.OptionalParam;
import ca.uhn.fhir.rest.annotation.Search;
import ca.uhn.fhir.rest.param.StringParam;
import com.fhirplatform.repository.FhirResourceRepository;
import org.hl7.fhir.r4.model.Organization;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class OrganizationResourceProvider extends BaseMongoResourceProvider<Organization> {

    public OrganizationResourceProvider(FhirResourceRepository repository, FhirContext fhirContext) {
        super(repository, fhirContext);
    }

    @Override
    public String getResourceTypeName() {
        return "Organization";
    }

    @Override
    public Class<Organization> getResourceClass() {
        return Organization.class;
    }

    @Search
    public List<Organization> searchOrganizations(
            @OptionalParam(name = Organization.SP_NAME) StringParam name) {

        Query query = new Query();

        if (name != null) {
            query.addCriteria(Criteria.where("content.name").regex(name.getValue(), "i"));
        }

        return repository.findByQuery(query, collectionName())
                .stream()
                .map(this::deserialize)
                .collect(Collectors.toList());
    }
}
