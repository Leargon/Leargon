package org.leargon.backend.bootstrap

import io.micronaut.context.event.ApplicationEventListener
import io.micronaut.context.event.StartupEvent
import jakarta.inject.Singleton
import org.slf4j.LoggerFactory
import java.util.Properties

@Singleton
open class VersionStartupLogger : ApplicationEventListener<StartupEvent> {
    companion object {
        private val LOG = LoggerFactory.getLogger(VersionStartupLogger::class.java)
    }

    override fun onApplicationEvent(event: StartupEvent) {
        val props = Properties()
        javaClass.classLoader.getResourceAsStream("app-version.properties")?.use { props.load(it) }
        val version = props.getProperty("version", "unknown")
        LOG.info("Léargon backend v{} started", version)
    }
}
