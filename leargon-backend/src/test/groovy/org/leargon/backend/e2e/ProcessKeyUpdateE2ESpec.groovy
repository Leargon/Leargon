package org.leargon.backend.e2e

import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpStatus
import io.micronaut.http.client.exceptions.HttpClientResponseException

class ProcessKeyUpdateE2ESpec extends AbstractE2ESpec {

    def "should successfully rename process when it has a flow diagram (DB cascade handled)"() {
        given:
        def token = signup("rename-bug@example.com", "renamebug")
        
        // 1. Create a process without a code (so key is name-based)
        def proc = createProcess(token, "Original Name")
        assert proc.key == "original-name"

        // 2. Add a simple flow diagram
        def saveFlowRequest = [
            nodes: [
                [id: "start", nodeType: "START_EVENT", position: 0, trackId: null],
                [id: "task", nodeType: "TASK", label: "Do something", position: 1, trackId: null],
                [id: "end", nodeType: "END_EVENT", position: 2, trackId: null]
            ],
            tracks: []
        ]
        
        client.toBlocking().exchange(
            HttpRequest.POST("/processes/${proc.key}/flow", saveFlowRequest).bearerAuth(token), Map
        )

        when: "3. Rename the process, which changes the key"
        client.toBlocking().exchange(
            HttpRequest.PUT("/processes/${proc.key}/names", [
                [locale: "en", text: "New Name"]
            ]).bearerAuth(token), Map
        )

        then: "It should ideally work, but currently it fails with DB exception"
        noExceptionThrown()
    }
}
