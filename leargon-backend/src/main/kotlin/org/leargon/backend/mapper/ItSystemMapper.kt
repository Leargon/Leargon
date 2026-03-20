package org.leargon.backend.mapper

import jakarta.inject.Singleton
import org.leargon.backend.domain.ItSystem
import org.leargon.backend.model.ItSystemResponse
import org.leargon.backend.model.ItSystemSummaryResponse
import org.leargon.backend.model.ProcessSummaryResponse
import java.time.ZoneOffset

@Singleton
class ItSystemMapper {

    fun toItSystemSummaryResponse(itSystem: ItSystem): ItSystemSummaryResponse =
        ItSystemSummaryResponse(itSystem.key, itSystem.getName("en"))

    fun toItSystemResponse(itSystem: ItSystem): ItSystemResponse =
        ItSystemResponse(
            itSystem.key,
            LocalizedTextMapper.toModel(itSystem.names),
            LocalizedTextMapper.toModel(itSystem.descriptions),
            itSystem.createdAt.atZone(ZoneOffset.UTC),
            itSystem.updatedAt?.atZone(ZoneOffset.UTC)
        )
            .vendor(itSystem.vendor)
            .systemUrl(itSystem.systemUrl)
            .linkedProcesses(itSystem.linkedProcesses.map { p ->
                ProcessSummaryResponse(p.key, p.getName("en"))
            })
}
