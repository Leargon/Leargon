package org.leargon.backend.e2e

import io.micronaut.http.HttpRequest

class ProcessKeyUpdateE2ESpec extends AbstractE2ESpec {

    def "should successfully rename process when it has a flow diagram (DB cascade handled)"() {
        given:
        def token = signupAdmin("rename-bug@example.com", "renamebug")
        
        // 1. Create a process without a code (so key is name-based)
        def proc = createProcess(token, "Original Name")
        assert proc.key == "original-name"

        // 2. Add a complex flow diagram
        def saveFlowRequest = [
            nodes: [
                [id: "start", nodeType: "START_EVENT", position: 0, trackId: null],
                [id: "task1", nodeType: "TASK", label: "Do something", position: 1, trackId: null],
                [id: "task2", nodeType: "TASK", label: "Link to self", position: 2, trackId: null, linkedProcessKey: proc.key],
                [id: "end", nodeType: "END_EVENT", position: 3, trackId: null]
            ],
            tracks: []
        ]
        
        client.toBlocking().exchange(
            HttpRequest.PUT("/processes/${proc.key}/flow", saveFlowRequest).bearerAuth(token), Map
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
