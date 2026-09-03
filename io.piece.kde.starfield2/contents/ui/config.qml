/*
    SPDX-License-Identifier: GPL-2.0-or-later
*/
import QtQuick
import QtQuick.Layouts
import QtQuick.Controls as QQC2
import org.kde.kirigami as Kirigami

Kirigami.FormLayout {
    twinFormLayouts: parentLayout

    property int    cfg_StarCount
    property double cfg_Speed
    property int    cfg_Direction
    property int    cfg_TinyStars
    property int    cfg_SmallStars
    property int    cfg_MediumStars
    property int    cfg_LargeStars
    property double cfg_ColorThreshold
    property int    cfg_NebulaCount
    property double cfg_NebulaOpacity
    property double cfg_NebulaOpacityMin
    property double cfg_NebulaSize
    property double cfg_NebulaSpawnProbability
    property double cfg_NebulaRotSpeedAvg
    property double cfg_NebulaRotSpeedVar
    property bool   cfg_PauseWhenBlocked
    property int    cfg_TargetFps
    property bool   cfg_DebugMode

    readonly property int totalWeight: Math.max(1,
        cfg_TinyStars + cfg_SmallStars + cfg_MediumStars + cfg_LargeStars)

    // Stars
    RowLayout {
        Kirigami.FormData.label: "Number of stars:"
        spacing: 8
        QQC2.Slider {
            id: countSlider
            Layout.preferredWidth: 260
            from: 10; to: 1000; stepSize: 1
            value: cfg_StarCount
            onValueChanged: cfg_StarCount = Math.round(value)
        }
        QQC2.Label {
            Layout.minimumWidth: 80
            horizontalAlignment: Text.AlignRight
            text: Math.round(countSlider.value)
        }
    }

    // Speed
    RowLayout {
        Kirigami.FormData.label: "Speed:"
        spacing: 8
        QQC2.Slider {
            id: speedSlider
            Layout.preferredWidth: 260
            from: 0.2; to: 5.0; stepSize: 0.1
            value: cfg_Speed
            onValueChanged: cfg_Speed = value
        }
        QQC2.Label {
            Layout.minimumWidth: 80
            horizontalAlignment: Text.AlignRight
            text: speedSlider.value.toFixed(1) + "×"
        }
    }

    // Direction
    QQC2.ComboBox {
        Kirigami.FormData.label: "Direction:"
        model: ["Up", "Down", "Right", "Left"]
        currentIndex: cfg_Direction
        onActivated: cfg_Direction = currentIndex
    }

    // Size equalizer
    Kirigami.Separator {
        Kirigami.FormData.isSection: true
        Kirigami.FormData.label: "Star size mix"
    }

    RowLayout {
        Kirigami.FormData.label: "Tiny  (r 0.1–0.5):"
        spacing: 8
        QQC2.Slider {
            id: tinySlider
            Layout.preferredWidth: 260
            from: 0; to: 1000; stepSize: 1
            value: cfg_TinyStars
            onValueChanged: cfg_TinyStars = Math.round(value)
        }
        QQC2.Label {
            Layout.minimumWidth: 80
            horizontalAlignment: Text.AlignRight
            text: (cfg_TinyStars / totalWeight * 100).toFixed(2) + "%"
        }
    }

    RowLayout {
        Kirigami.FormData.label: "Small (r 0.5–1.3):"
        spacing: 8
        QQC2.Slider {
            id: smallSlider
            Layout.preferredWidth: 260
            from: 0; to: 1000; stepSize: 1
            value: cfg_SmallStars
            onValueChanged: cfg_SmallStars = Math.round(value)
        }
        QQC2.Label {
            Layout.minimumWidth: 80
            horizontalAlignment: Text.AlignRight
            text: (cfg_SmallStars / totalWeight * 100).toFixed(2) + "%"
        }
    }

    RowLayout {
        Kirigami.FormData.label: "Medium (r 1.3–2.0):"
        spacing: 8
        QQC2.Slider {
            id: medSlider
            Layout.preferredWidth: 260
            from: 0; to: 1000; stepSize: 1
            value: cfg_MediumStars
            onValueChanged: cfg_MediumStars = Math.round(value)
        }
        QQC2.Label {
            Layout.minimumWidth: 80
            horizontalAlignment: Text.AlignRight
            text: (cfg_MediumStars / totalWeight * 100).toFixed(2) + "%"
        }
    }

    RowLayout {
        Kirigami.FormData.label: "Large (r 2.0–3.5):"
        spacing: 8
        QQC2.Slider {
            id: largeSlider
            Layout.preferredWidth: 260
            from: 0; to: 1000; stepSize: 1
            value: cfg_LargeStars
            onValueChanged: cfg_LargeStars = Math.round(value)
        }
        QQC2.Label {
            Layout.minimumWidth: 80
            horizontalAlignment: Text.AlignRight
            text: (cfg_LargeStars / totalWeight * 100).toFixed(2) + "%"
        }
    }

    // Color
    Kirigami.Separator {
        Kirigami.FormData.isSection: true
        Kirigami.FormData.label: "Color"
    }

    RowLayout {
        Kirigami.FormData.label: "Color from radius:"
        spacing: 8
        QQC2.Slider {
            id: colorSlider
            Layout.preferredWidth: 260
            from: 0.0; to: 3.5; stepSize: 0.05
            value: cfg_ColorThreshold
            onValueChanged: cfg_ColorThreshold = value
        }
        QQC2.Label {
            Layout.minimumWidth: 80
            horizontalAlignment: Text.AlignRight
            text: colorSlider.value.toFixed(2)
        }
    }
    QQC2.Label {
        text: "Stars with r < " + colorSlider.value.toFixed(2) + " appear grey-white"
    }

    // Nebulas
    Kirigami.Separator {
        Kirigami.FormData.isSection: true
        Kirigami.FormData.label: "Nebulas"
    }

    RowLayout {
        Kirigami.FormData.label: "Maximum nebulas:"
        spacing: 8
        QQC2.Slider {
            id: nebulaSlider
            Layout.preferredWidth: 260
            from: 0; to: 20; stepSize: 1
            value: cfg_NebulaCount
            onValueChanged: cfg_NebulaCount = Math.round(value)
        }
        QQC2.Label {
            Layout.minimumWidth: 80
            horizontalAlignment: Text.AlignRight
            text: Math.round(nebulaSlider.value)
        }
    }

    RowLayout {
        Kirigami.FormData.label: "Max opacity:"
        spacing: 8
        QQC2.Slider {
            id: opacitySlider
            Layout.preferredWidth: 260
            from: 0.05; to: 1.0; stepSize: 0.05
            value: cfg_NebulaOpacity
            onValueChanged: cfg_NebulaOpacity = value
        }
        QQC2.Label {
            Layout.minimumWidth: 80
            horizontalAlignment: Text.AlignRight
            text: opacitySlider.value.toFixed(2)
        }
    }

    RowLayout {
        Kirigami.FormData.label: "Min opacity:"
        spacing: 8
        QQC2.Slider {
            id: opacityMinSlider
            Layout.preferredWidth: 260
            from: 0.0; to: cfg_NebulaOpacity; stepSize: 0.01
            value: cfg_NebulaOpacityMin
            onValueChanged: cfg_NebulaOpacityMin = value
        }
        QQC2.Label {
            Layout.minimumWidth: 80
            horizontalAlignment: Text.AlignRight
            text: opacityMinSlider.value.toFixed(2)
        }
    }

    RowLayout {
        Kirigami.FormData.label: "Max size:"
        spacing: 8
        QQC2.Slider {
            id: sizeSlider
            Layout.preferredWidth: 260
            from: 50; to: 300; stepSize: 5
            value: cfg_NebulaSize
            onValueChanged: cfg_NebulaSize = value
        }
        QQC2.Label {
            Layout.minimumWidth: 80
            horizontalAlignment: Text.AlignRight
            text: sizeSlider.value.toFixed(0)
        }
    }

    RowLayout {
        Kirigami.FormData.label: "Spawn probability:"
        spacing: 8
        QQC2.Slider {
            id: spawnSlider
            Layout.preferredWidth: 260
            from: 0.0; to: 1.0; stepSize: 0.05
            value: cfg_NebulaSpawnProbability
            onValueChanged: cfg_NebulaSpawnProbability = value
        }
        QQC2.Label {
            Layout.minimumWidth: 80
            horizontalAlignment: Text.AlignRight
            text: (spawnSlider.value * 100).toFixed(0) + "%"
        }
    }

    RowLayout {
        Kirigami.FormData.label: "Avg rotation speed:"
        spacing: 8
        QQC2.Slider {
            id: rotAvgSlider
            Layout.preferredWidth: 260
            from: 10; to: 300; stepSize: 5
            value: cfg_NebulaRotSpeedAvg
            onValueChanged: cfg_NebulaRotSpeedAvg = value
        }
        QQC2.Label {
            Layout.minimumWidth: 80
            horizontalAlignment: Text.AlignRight
            text: rotAvgSlider.value.toFixed(0) + "s"
        }
    }

    RowLayout {
        Kirigami.FormData.label: "Rotation variation:"
        spacing: 8
        QQC2.Slider {
            id: rotVarSlider
            Layout.preferredWidth: 260
            from: 0; to: 150; stepSize: 5
            value: cfg_NebulaRotSpeedVar
            onValueChanged: cfg_NebulaRotSpeedVar = value
        }
        QQC2.Label {
            Layout.minimumWidth: 80
            horizontalAlignment: Text.AlignRight
            text: "±" + rotVarSlider.value.toFixed(0) + "s"
        }
    }

    // Performance
    Kirigami.Separator {
        Kirigami.FormData.isSection: true
        Kirigami.FormData.label: "Performance"
    }

    QQC2.CheckBox {
        Kirigami.FormData.label: "Pause when obscured:"
        text: "Pause simulation when covered by fullscreen or maximized windows"
        checked: cfg_PauseWhenBlocked
        onToggled: cfg_PauseWhenBlocked = checked
    }

    QQC2.ComboBox {
        Kirigami.FormData.label: "Target framerate:"
        model: ["60 FPS (Recommended - Smooth)", "30 FPS (Power Saver)", "Uncapped (Display VSync)"]
        currentIndex: cfg_TargetFps === 30 ? 1 : (cfg_TargetFps === 0 ? 2 : 0)
        onActivated: {
            if (currentIndex === 0) cfg_TargetFps = 60
            else if (currentIndex === 1) cfg_TargetFps = 30
            else cfg_TargetFps = 0
        }
    }

    // Debug
    Kirigami.Separator {
        Kirigami.FormData.isSection: true
        Kirigami.FormData.label: "Debug"
    }

    QQC2.CheckBox {
        Kirigami.FormData.label: "Debug overlay:"
        checked: cfg_DebugMode
        onToggled: cfg_DebugMode = checked
    }
}
