package com.fhirplatform.provider;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.annotation.*;
import ca.uhn.fhir.rest.api.MethodOutcome;
import ca.uhn.fhir.rest.server.IResourceProvider;
import ca.uhn.fhir.rest.server.exceptions.ResourceNotFoundException;
import com.fhirplatform.model.FhirResourceDocument;
import com.fhirplatform.repository.FhirResourceRepository;
import org.hl7.fhir.instance.model.api.IBaseResource;
import org.hl7.fhir.r4.model.IdType;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

public abstract class BaseMongoResourceProvider<T extends IBaseResource> implements IResourceProvider {

    protected final FhirResourceRepository repository;
    protected final FhirContext fhirContext;

    protected BaseMongoResourceProvider(FhirResourceRepository repository, FhirContext fhirContext) {
        this.repository = repository;
        this.fhirContext = fhirContext;
    }

    public abstract String getResourceTypeName();

    public abstract Class<T> getResourceClass();

    @Override
    public Class<T> getResourceType() {
        return getResourceClass();
    }

    protected String collectionName() {
        return FhirResourceDocument.collectionName(getResourceTypeName());
    }

    @Read
    public T getResourceById(@IdParam IdType id) {
        FhirResourceDocument doc = repository.findById(id.getIdPart(), collectionName())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Resource " + getResourceTypeName() + "/" + id.getIdPart() + " not found"));
        return deserialize(doc);
    }

    @Create
    public MethodOutcome createResource(@ResourceParam T resource) {
        String newId = UUID.randomUUID().toString();
        resource.setId(newId);

        FhirResourceDocument doc = FhirResourceDocument.builder()
                .id(newId)
                .resourceType(getResourceTypeName())
                .versionId(1)
                .lastUpdated(Instant.now())
                .content(serialize(resource))
                .build();

        repository.save(doc, collectionName());

        MethodOutcome outcome = new MethodOutcome();
        outcome.setId(new IdType(getResourceTypeName(), newId, "1"));
        outcome.setCreated(true);
        outcome.setResource(resource);
        return outcome;
    }

    @Update
    public MethodOutcome updateResource(@IdParam IdType id, @ResourceParam T resource) {
        FhirResourceDocument existing = repository.findById(id.getIdPart(), collectionName())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Resource " + getResourceTypeName() + "/" + id.getIdPart() + " not found"));

        int newVersion = existing.getVersionId() + 1;
        resource.setId(id.getIdPart());

        FhirResourceDocument doc = FhirResourceDocument.builder()
                .id(id.getIdPart())
                .resourceType(getResourceTypeName())
                .versionId(newVersion)
                .lastUpdated(Instant.now())
                .content(serialize(resource))
                .build();

        repository.save(doc, collectionName());

        MethodOutcome outcome = new MethodOutcome();
        outcome.setId(new IdType(getResourceTypeName(), id.getIdPart(), String.valueOf(newVersion)));
        outcome.setResource(resource);
        return outcome;
    }

    @Delete
    public void deleteResource(@IdParam IdType id) {
        if (repository.findById(id.getIdPart(), collectionName()).isEmpty()) {
            throw new ResourceNotFoundException(
                    "Resource " + getResourceTypeName() + "/" + id.getIdPart() + " not found");
        }
        repository.deleteById(id.getIdPart(), collectionName());
    }

    @Search
    public List<T> searchAll() {
        return repository.findAll(0, 100, collectionName())
                .stream()
                .map(this::deserialize)
                .collect(Collectors.toList());
    }

    protected org.bson.Document serialize(T resource) {
        String json = fhirContext.newJsonParser().encodeResourceToString(resource);
        return org.bson.Document.parse(json);
    }

    @SuppressWarnings("unchecked")
    protected T deserialize(FhirResourceDocument doc) {
        String json = doc.getContent().toJson();
        return (T) fhirContext.newJsonParser().parseResource(getResourceClass(), json);
    }
}
