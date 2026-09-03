/*
    SPDX-License-Identifier: GPL-2.0-or-later
*/
import QtQuick
import org.kde.plasma.plasmoid

WallpaperItem {
    id: wallpaper

    WindowModel {
        id: windowModel
    }

    Rectangle {
        id: bg
        anchors.fill: parent
        color: "black"

        readonly property bool   runSimulation:  windowModel.runSimulation
        readonly property bool   isPaused:       !runSimulation

        readonly property int    starCount:      wallpaper.configuration.StarCount
        readonly property double speedMult:      wallpaper.configuration.Speed
        readonly property int    direction:      wallpaper.configuration.Direction
        readonly property int    tinyW:          wallpaper.configuration.TinyStars
        readonly property int    smallW:         wallpaper.configuration.SmallStars
        readonly property int    mediumW:        wallpaper.configuration.MediumStars
        readonly property int    largeW:         wallpaper.configuration.LargeStars
        readonly property double colorThreshold: wallpaper.configuration.ColorThreshold
        readonly property int    nebulaCount:    wallpaper.configuration.NebulaCount
        readonly property double nebulaOpacity:  wallpaper.configuration.NebulaOpacity
        readonly property double nebulaOpacityMin: wallpaper.configuration.NebulaOpacityMin
        readonly property double nebulaSize:    wallpaper.configuration.NebulaSize
        readonly property double nebulaSpawn:   wallpaper.configuration.NebulaSpawnProbability
        readonly property double nebulaRotAvg:  wallpaper.configuration.NebulaRotSpeedAvg
        readonly property double nebulaRotVar:  wallpaper.configuration.NebulaRotSpeedVar
        readonly property int    targetFps:     (wallpaper.configuration.TargetFps !== undefined) ? wallpaper.configuration.TargetFps : 60
        readonly property bool   debugMode:     wallpaper.configuration.DebugMode

        readonly property bool isYAxis: direction === 0 || direction === 1

        readonly property vector2d travelVector: {
            switch (direction) {
            case 0: return Qt.vector2d( 0.0, -1.0); // Up
            case 1: return Qt.vector2d( 0.0,  1.0); // Down
            case 2: return Qt.vector2d( 1.0,  0.0); // Right
            case 3: return Qt.vector2d(-1.0,  0.0); // Left
            default: return Qt.vector2d(1.0,  0.0);
            }
        }

        // ── Debug helpers ─────────────────────────────────────────────────────

        function pad(val, width) {
            var s = Math.round(val).toString()
            while (s.length < width) s = " " + s
            return s
        }

        // ── Nebula helpers ────────────────────────────────────────────────────

        // 3-color palettes based on real emission line spectra
        function randomNebulaPalette() {
            var t = Math.floor(Math.random() * 5)
            if (t === 0) return [   // H II emission — Hα red, OIII teal, Hβ blue
                Qt.rgba(0.95, 0.14, 0.24, 1), Qt.rgba(0.04, 0.86, 0.72, 1), Qt.rgba(0.26, 0.42, 1.00, 1)]
            if (t === 1) return [   // Planetary — OIII teal, Hα red ring, Hβ blue
                Qt.rgba(0.00, 0.88, 0.82, 1), Qt.rgba(0.90, 0.10, 0.36, 1), Qt.rgba(0.14, 0.64, 0.96, 1)]
            if (t === 2) return [   // Supernova remnant — SII orange, Hα red, OIII teal
                Qt.rgba(1.00, 0.34, 0.04, 1), Qt.rgba(0.92, 0.08, 0.16, 1), Qt.rgba(0.06, 0.72, 0.92, 1)]
            if (t === 3) return [   // Wolf-Rayet bubble — HeII blue, OIII teal, He purple
                Qt.rgba(0.22, 0.32, 1.00, 1), Qt.rgba(0.00, 0.88, 0.76, 1), Qt.rgba(0.68, 0.18, 1.00, 1)]
            return [                // Reflection — cold scattered starlight blues
                Qt.rgba(0.34, 0.50, 1.00, 1), Qt.rgba(0.18, 0.32, 0.90, 1), Qt.rgba(0.58, 0.70, 1.00, 1)]
        }

        // ── Config-change reload ──────────────────────────────────────────────

        Connections {
            target: bg
            function onSpeedMultChanged()       { nebulasLoader.active = false; nebulasLoader.active = true }
            function onDirectionChanged()       { nebulasLoader.active = false; nebulasLoader.active = true }
            function onNebulaCountChanged()     { nebulasLoader.active = false; nebulasLoader.active = true }
            function onNebulaOpacityChanged()   { nebulasLoader.active = false; nebulasLoader.active = true }
            function onNebulaOpacityMinChanged(){ nebulasLoader.active = false; nebulasLoader.active = true }
            function onNebulaSizeChanged()      { nebulasLoader.active = false; nebulasLoader.active = true }
            function onNebulaSpawnChanged()     { nebulasLoader.active = false; nebulasLoader.active = true }
            function onNebulaRotAvgChanged()    { nebulasLoader.active = false; nebulasLoader.active = true }
            function onNebulaRotVarChanged()    { nebulasLoader.active = false; nebulasLoader.active = true }
        }

        // ── GLSL Starfield Shader ─────────────────────────────────────────────

        ShaderEffect {
            id: starShader
            anchors.fill: parent

            property real     u_time: 0.0
            property vector2d u_resolution: Qt.vector2d(bg.width > 0 ? bg.width : 1920, bg.height > 0 ? bg.height : 1080)
            property vector2d u_direction: bg.travelVector
            property real     u_speed: bg.speedMult
            property real     u_starCount: bg.starCount
            property vector4d u_starWeights: Qt.vector4d(bg.tinyW, bg.smallW, bg.mediumW, bg.largeW)
            property real     u_colorThreshold: bg.colorThreshold

            fragmentShader: Qt.resolvedUrl("../shaders/starfield.frag.qsb")

            // Paced frame rate timer (e.g. 60 FPS or 30 FPS)
            Timer {
                id: fpsTimer
                interval: bg.targetFps > 0 ? Math.round(1000 / bg.targetFps) : 16
                running: !bg.isPaused && bg.targetFps > 0
                repeat: true
                onTriggered: {
                    starShader.u_time += (interval / 1000.0)
                }
            }

            // Uncapped VSync mode (only active when targetFps === 0)
            NumberAnimation on u_time {
                from: 0.0
                to: 1000000.0
                duration: 1000000000
                loops: Animation.Infinite
                running: !bg.isPaused && bg.targetFps === 0
                paused: bg.isPaused || bg.targetFps > 0
            }
        }

        // ── Nebulas ───────────────────────────────────────────────────────────

        Loader {
            id: nebulasLoader
            anchors.fill: parent
            active: bg.width > 0 && bg.height > 0
            sourceComponent: nebulasComponent
        }

        Component {
            id: nebulasComponent
            Item {
                anchors.fill: parent
                Repeater {
                    model: bg.nebulaCount
                    delegate: Item {
                        id: neb

                        // Mutable — re-randomised each respawn
                        property var  nebColors:     []
                        property var  blobs:         []
                        property real nebulaBase:    150
                        property real nebulaOpacity: 0.0
                        property real rotSpeed:      80000
                        property bool rotCW:         true
                        property real speed:         8
                        property bool isActive:      true
                        readonly property real diameter: nebulaBase * 2.2  // blob offset (0.35) + radius (0.75) = 1.1 × 2

                        // Fixed geometry
                        readonly property real axisSpan:   bg.isYAxis ? bg.height : bg.width
                        readonly property real crossMax:   bg.isYAxis ? bg.width  : bg.height
                        // Actual content radius: blob offset (0.35) + max blob radius (0.75) = 1.1 × nebulaBase
                        // Reactive: updates when nebulaBase changes in respawn()
                        readonly property real canvasHalf: nebulaBase * 1.1 + 20
                        readonly property real mainFrom:   bg.direction === 0 ? axisSpan + canvasHalf :
                                                           bg.direction === 1 ? -canvasHalf :
                                                           bg.direction === 2 ? -canvasHalf : axisSpan + canvasHalf
                        readonly property real mainTo:     bg.direction === 0 ? -canvasHalf :
                                                           bg.direction === 1 ? axisSpan + canvasHalf :
                                                           bg.direction === 2 ? axisSpan + canvasHalf : -canvasHalf
                        readonly property real initMain:   Math.random() * axisSpan

                        function respawn() {
                            nebulaBase    = 80 + Math.random() * bg.nebulaSize
                            nebulaOpacity = bg.nebulaOpacityMin +
                                            Math.random() * Math.max(0, bg.nebulaOpacity - bg.nebulaOpacityMin)
                            var secs = Math.max(5, bg.nebulaRotAvg + (Math.random() * 2 - 1) * bg.nebulaRotVar)
                            rotSpeed  = secs * 1000
                            rotCW     = Math.random() >= 0.5
                            speed     = (2 + Math.random() * 10) * bg.speedMult
                            nebColors = bg.randomNebulaPalette()
                            isActive  = true

                            var n = 5 + Math.floor(Math.random() * 4)   // 5–8 blobs
                            var b = []
                            for (var i = 0; i < n; i++) {
                                var angle = Math.random() * Math.PI * 2
                                var dist  = Math.random() * nebulaBase * 0.35
                                b.push({
                                    dx:       Math.cos(angle) * dist,
                                    dy:       Math.sin(angle) * dist,
                                    r:        nebulaBase * (0.30 + Math.random() * 0.45),
                                    colorIdx: Math.floor(Math.random() * 3),
                                    a:        0.38 + Math.random() * 0.32
                                })
                            }
                            blobs = b   // triggers onBlobsChanged → repaint + rotation restart
                        }

                        // Rotation wrapper — pure GPU transform, keeps canvas out of the rotation path.
                        // Sized to actual nebula content so texture memory scales with nebulaBase.
                        Item {
                            id: nebRotator
                            // diameter + 40px padding each side
                            width:  neb.diameter + 40
                            height: neb.diameter + 40
                            x: -width  / 2
                            y: -height / 2
                            opacity: neb.isActive ? neb.nebulaOpacity : 0
                            visible: opacity > 0

                            Behavior on opacity { NumberAnimation { duration: 1000; easing.type: Easing.InOutQuad } }

                            Canvas {
                                id: nebCanvas
                                anchors.fill: parent

                                onAvailableChanged: if (available && neb.blobs.length > 0) requestPaint()

                                onPaint: {
                                    var sz = width
                                    var cx = sz / 2, cy = sz / 2
                                    var ctx = getContext("2d")
                                    ctx.clearRect(0, 0, sz, sz)
                                    var bArr   = neb.blobs
                                    var colors = neb.nebColors
                                    if (!bArr || !colors || colors.length === 0) return
                                    for (var i = 0; i < bArr.length; i++) {
                                        var b    = bArr[i]
                                        var c    = colors[b.colorIdx] || Qt.rgba(1, 1, 1, 1)
                                        var r255 = Math.round(c.r * 255)
                                        var g255 = Math.round(c.g * 255)
                                        var b255 = Math.round(c.b * 255)
                                        var bx   = cx + b.dx
                                        var by   = cy + b.dy
                                        var grad = ctx.createRadialGradient(bx, by, 0, bx, by, b.r)
                                        grad.addColorStop(0,   "rgba(" + r255 + "," + g255 + "," + b255 + "," + b.a.toFixed(3) + ")")
                                        grad.addColorStop(0.5, "rgba(" + r255 + "," + g255 + "," + b255 + "," + (b.a * 0.3).toFixed(3) + ")")
                                        grad.addColorStop(1,   "rgba(" + r255 + "," + g255 + "," + b255 + ",0)")
                                        ctx.fillStyle = grad
                                        ctx.beginPath()
                                        ctx.arc(bx, by, b.r, 0, Math.PI * 2)
                                        ctx.fill()
                                    }
                                }
                            }
                        }

                        // Continuous rotation on the wrapper Item — pure GPU transform
                        NumberAnimation {
                            id: rotAnim
                            target: nebRotator
                            property: "rotation"
                            from: 0; to: 360
                            loops: Animation.Infinite
                            running: false
                            paused: bg.isPaused
                        }

                        // Repaint and restart rotation (with correct direction) whenever blobs change
                        onBlobsChanged: {
                            nebCanvas.requestPaint()
                            rotAnim.stop()
                            nebRotator.rotation = 0
                            rotAnim.to       = neb.rotCW ? 360 : -360
                            rotAnim.duration = neb.rotSpeed
                            rotAnim.start()
                        }

                        // Position animation — mirrors the star pattern: one-shot lead-in, then infinite loop
                        SequentialAnimation {
                            id: nebAnim
                            running: false
                            paused: bg.isPaused

                            // Lead-in: from wherever the nebula starts to off-screen
                            NumberAnimation {
                                target: neb; property: bg.isYAxis ? "y" : "x"
                                to: neb.mainTo
                                duration: Math.abs(neb.initMain - neb.mainTo) / neb.speed * 1000
                                easing.type: Easing.Linear
                            }

                            // Infinite loop: roll spawn probability, reposition, traverse
                            SequentialAnimation {
                                loops: Animation.Infinite
                                paused: bg.isPaused
                                ScriptAction { script: {
                                    if (Math.random() < bg.nebulaSpawn) {
                                        neb.respawn()   // sets isActive = true, triggers rotation restart
                                    } else {
                                        neb.isActive = false   // hide; rotation keeps running
                                    }
                                    // Always reposition to entry edge for the next traverse
                                    if (bg.isYAxis) { neb.x = Math.random() * neb.crossMax; neb.y = neb.mainFrom }
                                    else            { neb.y = Math.random() * neb.crossMax; neb.x = neb.mainFrom }
                                }}
                                NumberAnimation {
                                    target: neb; property: bg.isYAxis ? "y" : "x"
                                    to: neb.mainTo
                                    duration: (neb.axisSpan + 2 * neb.canvasHalf) / neb.speed * 1000
                                    easing.type: Easing.Linear
                                }
                            }
                        }

                        Component.onCompleted: {
                            respawn()   // also triggers onBlobsChanged → rotAnim starts
                            // Honor spawn probability even on initial appearance
                            if (Math.random() >= bg.nebulaSpawn) {
                                isActive = false
                            }
                            if (bg.isYAxis) { x = Math.random() * crossMax; y = initMain }
                            else            { y = Math.random() * crossMax; x = initMain }
                            nebAnim.start()
                        }

                        // Debug label — offset by -neb.x/-neb.y to stay pinned at screen-left column
                        Text {
                            visible: bg.debugMode
                            z: 1000
                            x: -neb.x + 10
                            y: -neb.y + 28 + index * 14
                            color: neb.isActive ? "#00ff00" : "#888800"
                            font.family: "monospace"
                            font.pixelSize: 10
                            text: "Neb " + index + ": x=" + bg.pad(neb.x, 5) +
                                  "  y=" + bg.pad(neb.y, 5) +
                                  "  b=" + bg.pad(neb.nebulaBase, 3) +
                                  "  op=" + neb.nebulaOpacity.toFixed(2) +
                                  "  " + (neb.isActive ? "ACTIVE" : "inactive")
                        }
                    }
                }
            }
        }

        // Debug header — always top-left
        Text {
            visible: bg.debugMode
            z: 1000
            x: 10; y: 10
            color: bg.isPaused ? "#ff0000" : "#00ff00"
            font.family: "monospace"
            font.pixelSize: 11
            text: "DEBUG — Starfield GLSL / Nebulas " + (bg.isPaused ? "[PAUSED]" : "[RUNNING]")
        }

    }
}
