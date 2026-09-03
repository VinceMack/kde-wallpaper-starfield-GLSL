#version 440

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    float u_time;
    vec2  u_resolution;
    vec2  u_direction;
    float u_speed;
    float u_starCount;
    vec4  u_starWeights; // x=tiny, y=small, z=medium, w=large
    float u_colorThreshold;
};

// Fast 2D -> 4D pseudo-random hash
vec4 hash42(vec2 p) {
    vec4 p4 = fract(vec4(p.xyxy) * vec4(443.897, 441.423, 437.195, 444.129));
    p4 += dot(p4, p4.wzxy + 19.19);
    return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}

// Spectral star coloring based on stellar classification
vec3 spectralColor(float v, vec2 rand) {
    if (v < 0.04) return vec3(0.55 + rand.x * 0.15, 0.67 + rand.y * 0.12, 1.0);  // Blue-violet (O)
    if (v < 0.22) return vec3(0.78 + rand.x * 0.14, 0.86 + rand.y * 0.10, 1.0);  // Light blue (B)
    if (v < 0.52) return vec3(1.0, 0.97 + rand.x * 0.03, 0.88 + rand.y * 0.12); // White-yellow (A/F)
    if (v < 0.67) return vec3(1.0, 0.92 + rand.x * 0.06, 0.60 + rand.y * 0.18); // Yellow (G)
    if (v < 0.82) return vec3(1.0, 0.66 + rand.x * 0.14, 0.30 + rand.y * 0.14); // Orange (K)
    return vec3(1.0, 0.38 + rand.x * 0.18, 0.14 + rand.y * 0.12);               // Red (M)
}

void renderDepthSlice(
    inout vec3 accumColor,
    float pTravel,
    float pCross,
    float laneWidth,
    float segLength,
    float baseSpeed,
    float depthZ,
    float minRadius,
    float maxRadius,
    float spawnProbability,
    float layerId
) {
    if (spawnProbability <= 0.001) return;

    float laneFloat = pCross / laneWidth;
    float baseLane = floor(laneFloat);
    float laneFract = laneFloat - baseLane;
    float otherLane = baseLane + (laneFract < 0.5 ? -1.0 : 1.0);

    float laneArr[2];
    laneArr[0] = baseLane;
    laneArr[1] = otherLane;

    for (int l = 0; l < 2; l++) {
        float k = laneArr[l];
        vec4 hLane = hash42(vec2(k * 13.7 + layerId * 37.3, layerId * 91.1 + 17.7));

        // Individual speed multiplier for this track (±30% variance)
        float indSpeed = baseSpeed * (0.70 + hLane.y * 0.60);
        float travelShift = u_time * indSpeed + hLane.z * 1000.0;

        float shiftedTravel = pTravel - travelShift;
        float segFloat = shiftedTravel / segLength;
        float baseSeg = floor(segFloat);
        float segFract = segFloat - baseSeg;
        float otherSeg = baseSeg + (segFract < 0.5 ? -1.0 : 1.0);

        float segArr[2];
        segArr[0] = baseSeg;
        segArr[1] = otherSeg;

        for (int s = 0; s < 2; s++) {
            float seg = segArr[s];
            vec2 cellId = vec2(k * 73.1 + seg * 31.7, layerId * 53.9 + seg * 17.3);
            vec4 hStar = hash42(cellId);

            if (hStar.x > spawnProbability) continue;

            // Star position in rotated (travel, cross) space
            float starTravelPos = (seg + hStar.y * 0.7 + 0.15) * segLength + travelShift;
            float starCrossPos  = (k   + hStar.z * 0.7 + 0.15) * laneWidth;

            // Organic cross-axis micro-drift
            float driftFreq = 0.4 + hStar.w * 0.6;
            float driftAmp = mix(0.4, 2.5, depthZ);
            float drift = sin(u_time * driftFreq + hStar.x * 6.28318) * driftAmp;
            starCrossPos += drift;

            // Pixel-to-star distance in screen space
            float dTravel = pTravel - starTravelPos;
            float dCross  = pCross  - starCrossPos;
            float dist = sqrt(dTravel * dTravel + dCross * dCross);

            // Radius and Opacity
            float radius = mix(minRadius, maxRadius, hStar.w);

            // Atmospheric scintillation / twinkling
            float twinkleFreq = 1.8 + hStar.z * 3.5;
            float twinkle = 0.72 + 0.28 * sin(u_time * twinkleFreq + hStar.w * 6.28318);
            float opacity = (0.45 + hStar.y * 0.55) * twinkle;

            // Color
            bool hasGlow = (radius >= u_colorThreshold);
            vec3 col;
            if (hasGlow) {
                col = spectralColor(hStar.x, hStar.zw);
            } else {
                col = vec3(0.72 + hStar.x * 0.28);
            }

            // Core brightness with sub-pixel antialiasing
            float core = smoothstep(radius + 0.5, max(0.0, radius - 0.5), dist) * opacity;

            // Soft radial glow for larger stars (diameter = radius * 12, 3-stop falloff)
            float glow = 0.0;
            if (hasGlow) {
                float glowRadius = radius * 6.0;
                float t = dist / glowRadius;
                if (t < 1.0) {
                    float g = (t < 0.4) ? mix(0.50, 0.15, t / 0.4) : mix(0.15, 0.0, (t - 0.4) / 0.6);
                    glow = g * opacity;
                }
            }

            accumColor += col * (core + glow);
        }
    }
}

void main() {
    vec2 pixelCoord = qt_TexCoord0 * u_resolution;
    vec3 col = vec3(0.0); // Deep space black

    // Rotated coordinate frame along travel direction
    vec2 dir = normalize(u_direction);
    vec2 crossDir = vec2(-dir.y, dir.x);

    float pTravel = dot(pixelCoord, dir);
    float pCross  = dot(pixelCoord, crossDir);

    float totalWeight = max(1.0, u_starWeights.x + u_starWeights.y + u_starWeights.z + u_starWeights.w);
    float countFactor = clamp(u_starCount / 444.0, 0.02, 3.0);

    // Normalized weights for the 4 categories
    float wTiny   = (u_starWeights.x / totalWeight) * countFactor;
    float wSmall  = (u_starWeights.y / totalWeight) * countFactor;
    float wMed    = (u_starWeights.z / totalWeight) * countFactor;
    float wLarge  = (u_starWeights.w / totalWeight) * countFactor;

    // ── 8 Depth Layers (0 = deepest background, 7 = closest foreground) ──

    // Layer 0: Ultra-distant tiny background stars
    renderDepthSlice(col, pTravel, pCross, 28.0, 42.0, 16.0 * u_speed, 0.10, 0.15, 0.35, clamp(wTiny * 0.95, 0.0, 1.0), 0.0);

    // Layer 1: Distant tiny stars
    renderDepthSlice(col, pTravel, pCross, 38.0, 56.0, 22.0 * u_speed, 0.20, 0.25, 0.50, clamp(wTiny * 0.85, 0.0, 1.0), 1.0);

    // Layer 2: Far-midground small stars
    renderDepthSlice(col, pTravel, pCross, 50.0, 72.0, 30.0 * u_speed, 0.35, 0.50, 0.90, clamp(wSmall * 0.80, 0.0, 1.0), 2.0);

    // Layer 3: Midground small stars
    renderDepthSlice(col, pTravel, pCross, 68.0, 95.0, 40.0 * u_speed, 0.50, 0.80, 1.30, clamp(wSmall * 0.70, 0.0, 1.0), 3.0);

    // Layer 4: Near-midground medium stars
    renderDepthSlice(col, pTravel, pCross, 90.0, 125.0, 52.0 * u_speed, 0.65, 1.30, 1.65, clamp(wMed * 0.65, 0.0, 1.0), 4.0);

    // Layer 5: Near medium stars
    renderDepthSlice(col, pTravel, pCross, 120.0, 165.0, 66.0 * u_speed, 0.78, 1.60, 2.00, clamp(wMed * 0.55, 0.0, 1.0), 5.0);

    // Layer 6: Close large stars with luminous halos
    renderDepthSlice(col, pTravel, pCross, 155.0, 215.0, 82.0 * u_speed, 0.90, 2.00, 2.75, clamp(wLarge * 0.45, 0.0, 1.0), 6.0);

    // Layer 7: Foreground large stars streaking rapidly with wide glow
    renderDepthSlice(col, pTravel, pCross, 200.0, 275.0, 102.0 * u_speed, 1.00, 2.60, 3.50, clamp(wLarge * 0.35, 0.0, 1.0), 7.0);

    fragColor = vec4(col, 1.0) * qt_Opacity;
}
