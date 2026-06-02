package com.fhirplatform.repository;

import com.fhirplatform.model.FhirResourceDocument;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class FhirResourceRepository {

    private final MongoTemplate mongoTemplate;

    public FhirResourceRepository(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    public FhirResourceDocument save(FhirResourceDocument doc, String collectionName) {
        return mongoTemplate.save(doc, collectionName);
    }

    public Optional<FhirResourceDocument> findById(String id, String collectionName) {
        FhirResourceDocument doc = mongoTemplate.findById(id, FhirResourceDocument.class, collectionName);
        return Optional.ofNullable(doc);
    }

    public List<FhirResourceDocument> findByQuery(Query query, String collectionName) {
        return mongoTemplate.find(query, FhirResourceDocument.class, collectionName);
    }

    public void deleteById(String id, String collectionName) {
        Query query = new Query(Criteria.where("_id").is(id));
        mongoTemplate.remove(query, FhirResourceDocument.class, collectionName);
    }

    public long count(String collectionName) {
        return mongoTemplate.count(new Query(), collectionName);
    }

    public List<FhirResourceDocument> findAll(int offset, int count, String collectionName) {
        Query query = new Query().skip(offset).limit(count);
        return mongoTemplate.find(query, FhirResourceDocument.class, collectionName);
    }
}
