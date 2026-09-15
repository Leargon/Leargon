package org.leargon.backend.util

/**
 * Turns a name-derived base key into a unique one by appending `-2`, `-3`, … when [exists] reports the
 * candidate as taken. Keys are derived from display names, so two legitimately distinct items (a
 * justified duplicate, or the same process name in two bounded contexts) must not collide on the
 * unique key constraint.
 */
object KeyAllocator {
    fun allocate(
        base: String,
        exists: (String) -> Boolean
    ): String {
        if (!exists(base)) return base
        var suffix = 2
        while (exists("$base-$suffix")) suffix++
        return "$base-$suffix"
    }
}
