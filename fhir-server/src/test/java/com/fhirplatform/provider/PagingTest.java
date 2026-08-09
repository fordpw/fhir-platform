package com.fhirplatform.provider;

import ca.uhn.fhir.context.FhirContext;
import ca.uhn.fhir.rest.api.server.IBundleProvider;
import com.fhirplatform.model.FhirResourceDocument;
import com.fhirplatform.repository.FhirResourceRepository;
import org.bson.Document;
import org.hl7.fhir.r4.model.Patient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Covers paging in {@link BaseMongoResourceProvider}.
 *
 * Two regressions guarded here:
 *  - _offset was ignored entirely, so page 2 returned the same rows as page 1.
 *  - searchAll capped results at 100 and that cap leaked into Bundle.total, so
 *    Observation reported 100 matches when it held 3056.
 */
class PagingTest {

    private FhirResourceRepository repository;
    private TestPatientProvider provider;

    /** Minimal concrete provider so the abstract base can be exercised. */
    private static class TestPatientProvider extends BaseMongoResourceProvider<Patient> {
        TestPatientProvider(FhirResourceRepository repo, FhirContext ctx) {
            super(repo, ctx);
        }

        @Override
        public String getResourceTypeName() {
            return "Patient";
        }

        @Override
        public Class<Patient> getResourceClass() {
            return Patient.class;
        }

        IBundleProvider callPage(Query q, Integer count, Integer offset) {
            return page(q, count, offset);
        }
    }

    private static FhirResourceDocument doc(String id) {
        return FhirResourceDocument.builder()
                .id(id)
                .resourceType("Patient")
                .versionId(1)
                .lastUpdated(Instant.now())
                .content(Document.parse(
                        "{\"resourceType\":\"Patient\",\"id\":\"" + id + "\"}"))
                .build();
    }

    private static List<FhirResourceDocument> docs(int n) {
        List<FhirResourceDocument> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            out.add(doc("patient-" + i));
        }
        return out;
    }

    @BeforeEach
    void setUp() {
        repository = mock(FhirResourceRepository.class);
        provider = new TestPatientProvider(repository, FhirContext.forR4());
    }

    @Test
    @DisplayName("Bundle.total reports the full match count, not the page size")
    void totalReflectsFullMatchCount() {
        when(repository.countByQuery(any(Query.class), anyString())).thenReturn(3056L);
        when(repository.findByQuery(any(Query.class), anyString())).thenReturn(docs(3));

        IBundleProvider result = provider.callPage(new Query(), 3, 0);

        assertThat(result.size()).isEqualTo(3056);
        assertThat(result.getResources(0, 3)).hasSize(3);
    }

    @Test
    @DisplayName("_offset and _count are pushed into the Mongo query")
    void offsetAndCountArePushedToMongo() {
        when(repository.countByQuery(any(Query.class), anyString())).thenReturn(50L);
        when(repository.findByQuery(any(Query.class), anyString())).thenReturn(docs(5));

        provider.callPage(new Query(), 5, 20);

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        org.mockito.Mockito.verify(repository).findByQuery(captor.capture(), anyString());

        assertThat(captor.getValue().getSkip()).isEqualTo(20L);
        assertThat(captor.getValue().getLimit()).isEqualTo(5);
    }

    @Test
    @DisplayName("omitting _count applies the default page size rather than everything")
    void defaultPageSizeApplied() {
        when(repository.countByQuery(any(Query.class), anyString())).thenReturn(5000L);
        when(repository.findByQuery(any(Query.class), anyString())).thenReturn(docs(20));

        provider.callPage(new Query(), null, null);

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        org.mockito.Mockito.verify(repository).findByQuery(captor.capture(), anyString());

        assertThat(captor.getValue().getLimit())
                .isEqualTo(BaseMongoResourceProvider.DEFAULT_PAGE_SIZE);
        assertThat(captor.getValue().getSkip()).isZero();
    }

    @Test
    @DisplayName("_count is capped so a client cannot request an entire collection")
    void countIsCapped() {
        when(repository.countByQuery(any(Query.class), anyString())).thenReturn(100_000L);
        when(repository.findByQuery(any(Query.class), anyString())).thenReturn(docs(1));

        provider.callPage(new Query(), 999_999, 0);

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        org.mockito.Mockito.verify(repository).findByQuery(captor.capture(), anyString());

        assertThat(captor.getValue().getLimit())
                .isEqualTo(BaseMongoResourceProvider.MAX_PAGE_SIZE);
    }

    @Test
    @DisplayName("a negative or zero offset is treated as the first page")
    void negativeOffsetIsClamped() {
        when(repository.countByQuery(any(Query.class), anyString())).thenReturn(10L);
        when(repository.findByQuery(any(Query.class), anyString())).thenReturn(docs(2));

        provider.callPage(new Query(), 2, -5);

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        org.mockito.Mockito.verify(repository).findByQuery(captor.capture(), anyString());

        assertThat(captor.getValue().getSkip()).isZero();
    }

    @Test
    @DisplayName("the count query is taken before paging is applied to it")
    void countIsNotAffectedByPaging() {
        // Counting after skip/limit would report the page size and reintroduce
        // the original bug, where total tracked the page rather than the match set.
        when(repository.countByQuery(any(Query.class), anyString())).thenReturn(500L);
        when(repository.findByQuery(any(Query.class), anyString())).thenReturn(docs(10));

        IBundleProvider result = provider.callPage(new Query(), 10, 100);

        ArgumentCaptor<Query> counted = ArgumentCaptor.forClass(Query.class);
        org.mockito.Mockito.verify(repository).countByQuery(counted.capture(), anyString());

        assertThat(counted.getValue().getLimit()).isZero();
        assertThat(counted.getValue().getSkip()).isZero();
        assertThat(result.size()).isEqualTo(500);
    }
}
