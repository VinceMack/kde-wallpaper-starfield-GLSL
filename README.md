# KDE Plasma 6 Wallpaper: Animated Starfield (GLSL Edition)

[![KDE Plasma 6](https://img.shields.io/badge/KDE%20Plasma-6-blue.svg)](https://kde.org/plasma-desktop/)
[![Qt 6](https://img.shields.io/badge/Qt-6.x-green.svg)](https://www.qt.io/)

A hyper-optimized, dynamic 3D volumetric animated starfield wallpaper for **KDE Plasma 6**.

Built with a dedicated **Qt 6 RHI GLSL fragment shader**, this edition offloads the entire starfield simulation to the GPU, leaving the CPU 100% idle and eliminating desktop interaction latency.

---

## Features

- **Hyper-Optimized GPU Shader**:
  - Full simulation rendered in a single GLSL fragment shader via Qt 6's Rendering Hardware Interface (RHI).
  - Multi-backend support for **Vulkan**, **OpenGL**, and **Metal**.
  - Ultra-low overhead (~4% GPU usage uncapped at 144 Hz across dual high-resolution monitors from my testing on a 9070XT).
  - Direct write-only framebuffer rendering (`blending: false`) with zero square roots, zero trigonometric loops in empty space, and 1D dual-axis geometric pre-filtering.

- **Dynamic 3D Volumetric Depth & Organic Overtaking**:
  - 4 continuous depth layers corresponding to star size classes (Tiny, Small, Medium, Large).
  - Individual per-star velocity jitter ($\pm 30\%$), allowing stars within the same tier to organically overtake and glide past each other rather than moving in rigid sheets.

- **Vibrant 10-Class Celestial Spectral Palette**:
  - High-chroma astronomical stellar classifications with branchless GPU color mapping:
    - **Ultraviolet / Wolf-Rayet** (Electric Violet)
    - **Class O** (Deep Sapphire Blue)
    - **Class B** (Electric Azure Cyan)
    - **Class A** (Brilliant Crystalline Diamond)
    - **Class G** (Solar Warm Gold)
    - **Class K** (Fiery Molten Amber)
    - **Class M** (Deep Cosmic Ruby Red)
    - **Cosmic Pulsar** (Radiant Magenta)
    - **Emerald Binary Emission** (Sparkling Green)
  - **White-Hot Nucleus + Chromatic Corona**: Piercing bright cores surrounded by rich, saturated photometric bloom falloffs.
  - Crisp, silver-white diamond stars below the spectral color threshold.

- **Atmospheric Scintillation & Organic Micro-Drift**:
  - Independent twinkling pulsation per star calculated with ultra-fast triangle waves.
  - Subtle sinusoidal cross-axis wave float, breaking robotic linear paths in favor of natural celestial drift.

- **Smart Window Occlusion & Simulation Pause**:
  - Automatically detects when fullscreen or maximized windows cover the wallpaper on the current screen/desktop/activity and freezes the simulation.
  - GPU overhead drops to **0.0%** whenever obscured.

- **Target Framerate Pacing**:
  - Built-in frame-rate limiter under the **Performance** settings:
    - **60 FPS (Recommended - Smooth)**: Prevents high-refresh gaming monitors (120Hz/144Hz/240Hz) from redundantly over-rendering the background.
    - **30 FPS (Power Saver)**: Ultra-low power consumption for laptops or battery operation.
    - **Uncapped (Display VSync)**: Runs at the native monitor refresh rate.

- **Procedural Rotating Nebulas**:
  - Soft, multi-blob rotating gas clouds featuring authentic emission line spectra (H II emission, Planetary, Supernova remnant, Wolf-Rayet bubble, and Reflection).

- **Full Customization**:
  - Star Count (10 to 1,000)
  - Speed Multiplier (0.2× to 5.0×)
  - Direction of Travel (Up, Down, Right, Left)
  - 4-Tier Star Size Equalizer (Tiny, Small, Medium, Large weights)
  - Spectral Color Radius Threshold
  - Nebula Count, Opacity, Size, Spawn Chance, and Rotation Speed

---

## Manual Installation

### Requirements
- KDE Plasma 6
- Qt 6 (with `qml-module-org-kde-kitemmodels` and `qml-module-org-kde-taskmanager`)

### Installing / Updating the Plugin

1. Download the latest release and extract its contents to a folder.
2. Open a terminal in the extracted directory and install the package using `kpackagetool6`:

```bash
# Install for the current user:
kpackagetool6 -t Plasma/Wallpaper -i io.vince.kde.starfield.glsl

# Or to update an existing installation:
kpackagetool6 -t Plasma/Wallpaper -u io.vince.kde.starfield.glsl
```

3. Right-click on your desktop, select **Configure Desktop and Wallpaper...**, and choose **Starfield (GLSL)** from the Wallpaper Type dropdown.

### Uninstalling

```bash
kpackagetool6 -t Plasma/Wallpaper -r io.vince.kde.starfield.glsl
```

---

## Compiling Shaders (For Developers)

The package includes pre-compiled `.qsb` shader binaries in `contents/shaders/`. If you modify `io.vince.kde.starfield.glsl/contents/shaders/starfield.frag`, recompile it with `qsb` (Qt Shader Baker):

```bash
qsb-qt6 --qt6 -o io.vince.kde.starfield.glsl/contents/shaders/starfield.frag.qsb io.vince.kde.starfield.glsl/contents/shaders/starfield.frag
```

---

## Credits & Acknowledgements

- **Original Creator**: This project was heavily inspired by and built upon the design and visual concept of [**kde-wallpaper-starfield**](https://github.com/piecler/kde-wallpaper-starfield) by [**piecler**](https://github.com/piecler) ([KDE Store Page](https://store.kde.org/p/2351283/)).
- **Window Occlusion Logic**: Adapted from [**PlasmaWallpaper_CityGrow**](https://github.com/HobbyBlobby/PlasmaWallpaper_CityGrow) by [**HobbyBlobby**](https://github.com/HobbyBlobby).

---
