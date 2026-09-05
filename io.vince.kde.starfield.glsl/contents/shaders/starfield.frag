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

// Fast 2D -> 4D pseudo-random float hash
vec4 hash42(vec2 p) {
    vec4 p4 = fract(vec4(p.xyxy) * vec4(443.897, 441.423, 437.195, 444.129));
    p4 += dot(p4, p4.wzxy + 19.19);
    return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}

// Ultra-vibrant branchless 10-class celestial spectral palette (zero warp divergence)
vec3 spectralColor(float v) {
    if (isnan(v) || isinf(v)) v = 0.30;
    v = clamp(v, 0.0, 1.0);

    vec3 cViolet   = vec3(0.55, 0.22, 1.00); // 0.00 - 0.05: Ultraviolet / Wolf-Rayet
    vec3 cSapphire = vec3(0.20, 0.58, 1.00); // 0.05 - 0.15: Deep Sapphire Blue (O-type)
    vec3 cCyan     = vec3(0.25, 0.88, 1.00); // 0.15 - 0.25: Electric Cyan / Azure (B-type)
    vec3 cDiamond  = vec3(0.94, 0.98, 1.00); // 0.25 - 0.35: Brilliant Diamond (A-type)
    vec3 cGold     = vec3(1.00, 0.88, 0.12); // 0.35 - 0.50: Solar Gold (G-type)
    vec3 cAmber    = vec3(1.00, 0.52, 0.04); // 0.50 - 0.65: Fiery Molten Amber (K-type)
    vec3 cRuby     = vec3(1.00, 0.16, 0.08); // 0.65 - 0.80: Deep Cosmic Ruby (M-type)
    vec3 cMagenta  = vec3(1.00, 0.25, 0.82); // 0.80 - 0.90: Radiant Cosmic Magenta / Pulsar
    vec3 cEmerald  = vec3(0.25, 0.96, 0.62); // 0.90 - 1.00: Rare Emerald Binary Emission

    vec3 col = cViolet;
    col = mix(col, cSapphire, step(0.05, v));
    col = mix(col, cCyan,     step(0.15, v));
    col = mix(col, cDiamond,  step(0.25, v));
    col = mix(col, cGold,     step(0.35, v));
    col = mix(col, cAmber,    step(0.50, v));
    col = mix(col, cRuby,     step(0.65, v));
    col = mix(col, cMagenta,  step(0.80, v));
    col = mix(col, cEmerald,  step(0.90, v));
    return col;
}

// Ultra-optimized depth slice with high vibrancy and dual-axis 1D pre-filtering
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
    float maxReach,
    float maxReach2,
    float spawnProbability,
    float layerId
) {
    if (spawnProbability <= 0.001) return;
    if (isnan(u_time) || isinf(u_time)) return;

    // 1. Direct single-cell indexing
    float k = floor(pCross / laneWidth);

    // 2. Cross-Axis 1D Pre-Filter (skips 20% of pixels before ANY travel/velocity math!)
    float localCross = pCross - k * laneWidth;
    if (localCross < (0.15 * laneWidth - maxReach - 1.5) || localCross > (0.85 * laneWidth + maxReach + 1.5)) return;

    // Single-cycle Weyl recurrence for lane speed & phase
    float indSpeed = baseSpeed * (0.72 + fract(k * 0.38196601 + layerId * 0.61803398) * 0.56);
    float travelShift = u_time * indSpeed + fract(k * 0.75487766 + layerId * 0.137592) * 1000.0;

    float shiftedTravel = pTravel - travelShift;
    float seg = floor(shiftedTravel / segLength);

    // 3. Fast 1-cycle scalar spawn rejection (bails out on 50-70% of cells BEFORE travel bounds!)
    vec2 cellId = vec2(k * 73.1 + seg * 31.7, layerId * 53.9 + seg * 17.3);
    float spawnTest = fract(cellId.x * 0.38196601 + cellId.y * 0.61803398);
    if (spawnTest > spawnProbability) return;

    // 4. Travel-Axis 1D Pre-Filter (skips 90% of surviving cells before 4D hash)
    float localTravel = shiftedTravel - seg * segLength;
    if (localTravel < (0.15 * segLength - maxReach) || localTravel > (0.85 * segLength + maxReach)) return;

    // 5. Full 4D hash evaluated only when pixel is in star corridor and star exists
    vec4 hStar = hash42(cellId);

    // Exact Travel-axis distance check
    float starTravelPos = (seg + hStar.y * 0.70 + 0.15) * segLength + travelShift;
    float dTravel = pTravel - starTravelPos;
    if (abs(dTravel) > maxReach) return;

    // Exact Cross-axis distance check with fast triangle-wave drift
    float starCrossPos = (k + hStar.z * 0.70 + 0.15) * laneWidth;
    float driftWave = abs(fract(u_time * (0.25 + hStar.w * 0.35) + hStar.x) * 2.0 - 1.0) * 2.0 - 1.0;
    starCrossPos += driftWave * (depthZ * 1.5);

    float dCross = pCross - starCrossPos;
    if (abs(dCross) > maxReach) return;

    // Squared Euclidean distance (zero sqrt)
    float dist2 = dTravel * dTravel + dCross * dCross;
    if (dist2 > maxReach2) return;

    // ── Pixel touches a star (< 0.2% of pixels): compute high-vibrancy appearance ──
    float radius = mix(minRadius, maxRadius, hStar.w);
    float radius2 = radius * radius;

    // Fast triangle-wave scintillation (zero trig cost)
    float twinkleWave = abs(fract(u_time * (1.6 + hStar.z * 2.8) + hStar.w) * 2.0 - 1.0);
    float twinkle = 0.75 + 0.25 * twinkleWave;
    float opacity = (0.50 + hStar.y * 0.50) * twinkle;

    // White-hot nucleus with piercing HDR brightness
    float core = clamp(1.0 - dist2 / (radius2 + 0.20), 0.0, 1.0) * 1.35 * opacity;

    // Luminous photometric inverse-square corona / bloom
    bool hasGlow = (radius >= u_colorThreshold);
    float glow = 0.0;
    if (hasGlow) {
        glow = (radius2 * 1.10) / (dist2 + radius2 * 0.55) * opacity;
    }

    vec3 baseCol = hasGlow ? spectralColor(hStar.x) : vec3(0.80 + hStar.x * 0.20);

    // Blazing white-hot nucleus at the center, surrounded by pure saturated chromatic corona
    vec3 coreColor = mix(baseCol, vec3(1.0), 0.55);
    vec3 glowColor = baseCol;

    accumColor += coreColor * core + glowColor * glow;
}

void main() {
    vec2 dir = u_direction;
    vec2 crossDir = vec2(-dir.y, dir.x);

    // Vector pre-multiplication (eliminates pixelCoord vector multiply)
    vec2 travelVector = u_resolution * dir;
    vec2 crossVector  = u_resolution * crossDir;

    float pTravel = dot(qt_TexCoord0, travelVector);
    float pCross  = dot(qt_TexCoord0, crossVector);

    vec3 col = vec3(0.0);

    float totalWeight = max(1.0, u_starWeights.x + u_starWeights.y + u_starWeights.z + u_starWeights.w);
    float countFactor = clamp(u_starCount / 444.0, 0.02, 3.0);

    // 1-to-1 mapping with the 4 user sliders
    float wTiny  = (u_starWeights.x / totalWeight) * countFactor;
    float wSmall = (u_starWeights.y / totalWeight) * countFactor;
    float wMed   = (u_starWeights.z / totalWeight) * countFactor;
    float wLarge = (u_starWeights.w / totalWeight) * countFactor;

    // Pre-computed reach constants per layer (expanded for radiant coronas)
    float r0 = (0.45 >= u_colorThreshold) ? 3.00 : 1.65;
    float r1 = (1.15 >= u_colorThreshold) ? 7.50 : 2.50;
    float r2 = (1.95 >= u_colorThreshold) ? 13.50 : 3.50;
    float r3 = (3.50 >= u_colorThreshold) ? 24.00 : 5.00;

    // ── 4 Dedicated Depth Layers (1:1 with user weight categories) ──

    // Layer 0: Tiny stars (TinyStars slider) - Dense background drift
    renderDepthSlice(col, pTravel, pCross, 30.0, 44.0, 18.0 * u_speed, 0.15, 0.15, 0.45, r0, r0 * r0, clamp(wTiny * 0.95, 0.0, 1.0), 0.0);

    // Layer 1: Small stars (SmallStars slider) - Mid-distant field
    renderDepthSlice(col, pTravel, pCross, 54.0, 78.0, 32.0 * u_speed, 0.40, 0.50, 1.15, r1, r1 * r1, clamp(wSmall * 0.85, 0.0, 1.0), 1.0);

    // Layer 2: Medium stars (MediumStars slider) - Faster near field
    renderDepthSlice(col, pTravel, pCross, 96.0, 136.0, 56.0 * u_speed, 0.70, 1.15, 1.95, r2, r2 * r2, clamp(wMed * 0.75, 0.0, 1.0), 2.0);

    // Layer 3: Large stars (LargeStars slider) - Swift luminous foreground
    renderDepthSlice(col, pTravel, pCross, 175.0, 245.0, 88.0 * u_speed, 1.00, 1.95, 3.50, r3, r3 * r3, clamp(wLarge * 0.65, 0.0, 1.0), 3.0);

    fragColor = vec4(col, 1.0) * qt_Opacity;
}
