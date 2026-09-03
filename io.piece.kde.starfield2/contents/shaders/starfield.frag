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

// Branchless spectral color palette (zero warp divergence)
vec3 spectralColor(float v) {
    vec3 cO = vec3(0.60, 0.72, 1.00); // Blue-violet (O)
    vec3 cB = vec3(0.80, 0.88, 1.00); // Light blue (B)
    vec3 cA = vec3(1.00, 0.98, 0.92); // White-yellow (A/F)
    vec3 cG = vec3(1.00, 0.92, 0.60); // Yellow (G)
    vec3 cK = vec3(1.00, 0.66, 0.30); // Orange (K)
    vec3 cM = vec3(1.00, 0.38, 0.14); // Red (M)

    vec3 col = cO;
    col = mix(col, cB, step(0.04, v));
    col = mix(col, cA, step(0.22, v));
    col = mix(col, cG, step(0.52, v));
    col = mix(col, cK, step(0.67, v));
    col = mix(col, cM, step(0.82, v));
    return col;
}

// Ultra-optimized depth slice with Weyl recurrence and two-stage early bailout
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

    // 1. Direct single-cell indexing
    float k = floor(pCross / laneWidth);

    // Single-cycle Weyl recurrence for lane speed & phase (eliminates 4D hash call)
    float indSpeed = baseSpeed * (0.72 + fract(k * 0.38196601 + layerId * 0.61803398) * 0.56);
    float travelShift = u_time * indSpeed + fract(k * 0.75487766 + layerId * 0.137592) * 1000.0;

    float shiftedTravel = pTravel - travelShift;
    float seg = floor(shiftedTravel / segLength);

    // 2. Fast 1-cycle scalar spawn rejection before full hash
    vec2 cellId = vec2(k * 73.1 + seg * 31.7, layerId * 53.9 + seg * 17.3);
    float spawnTest = fract(dot(cellId, vec2(0.38196601, 0.61803398)) * 43.17);
    if (spawnTest > spawnProbability) return;

    // Full 4D hash evaluated only if star exists in cell
    vec4 hStar = hash42(cellId);

    // Maximum light reach in pixels for early bailout
    float maxReach = (maxRadius >= u_colorThreshold) ? (maxRadius * 6.0) : (maxRadius + 1.2);

    // 3. Early-out: Travel-axis distance check
    float starTravelPos = (seg + hStar.y * 0.70 + 0.15) * segLength + travelShift;
    float dTravel = pTravel - starTravelPos;
    if (abs(dTravel) > maxReach) return; // 99% of empty pixels exit here

    // 4. Early-out: Cross-axis distance check with fast triangle-wave drift
    float starCrossPos = (k + hStar.z * 0.70 + 0.15) * laneWidth;
    float driftWave = abs(fract(u_time * (0.25 + hStar.w * 0.35) + hStar.x) * 2.0 - 1.0) * 2.0 - 1.0;
    starCrossPos += driftWave * (depthZ * 1.5);

    float dCross = pCross - starCrossPos;
    if (abs(dCross) > maxReach) return;

    // 5. Squared Euclidean distance (zero sqrt)
    float dist2 = dTravel * dTravel + dCross * dCross;
    float maxReach2 = maxReach * maxReach;
    if (dist2 > maxReach2) return;

    // ── Pixel touches a star (< 0.2% of pixels): compute appearance ──
    float radius = mix(minRadius, maxRadius, hStar.w);
    float radius2 = radius * radius;

    // Fast triangle-wave scintillation (zero trig cost)
    float twinkleWave = abs(fract(u_time * (1.6 + hStar.z * 2.8) + hStar.w) * 2.0 - 1.0);
    float twinkle = 0.72 + 0.28 * twinkleWave;
    float opacity = (0.45 + hStar.y * 0.55) * twinkle;

    // Core brightness: quadratic smooth falloff
    float core = clamp(1.0 - dist2 / (radius2 + 0.25), 0.0, 1.0) * opacity;

    // Photometric inverse-square glow
    bool hasGlow = (radius >= u_colorThreshold);
    float glow = 0.0;
    if (hasGlow) {
        glow = (radius2 * 0.45) / (dist2 + radius2 * 0.65) * opacity;
    }

    vec3 col = hasGlow ? spectralColor(hStar.x) : vec3(0.72 + hStar.x * 0.28);
    accumColor += col * (core + glow);
}

void main() {
    vec2 pixelCoord = qt_TexCoord0 * u_resolution;
    vec3 col = vec3(0.0);

    // Pre-normalized travel & cross vectors (no per-pixel normalize() overhead)
    vec2 dir = u_direction;
    vec2 crossDir = vec2(-dir.y, dir.x);

    float pTravel = dot(pixelCoord, dir);
    float pCross  = dot(pixelCoord, crossDir);

    float totalWeight = max(1.0, u_starWeights.x + u_starWeights.y + u_starWeights.z + u_starWeights.w);
    float countFactor = clamp(u_starCount / 444.0, 0.02, 3.0);

    float wTiny  = (u_starWeights.x / totalWeight) * countFactor;
    float wSmall = (u_starWeights.y / totalWeight) * countFactor;
    float wMed   = (u_starWeights.z / totalWeight) * countFactor;
    float wLarge = (u_starWeights.w / totalWeight) * countFactor;

    // ── 5 Finely Balanced Parallax Layers ─────────────────────────────────

    // Layer 0: Deep background tiny stars (highest density, slowest drift)
    renderDepthSlice(col, pTravel, pCross, 30.0, 44.0, 16.0 * u_speed, 0.12, 0.15, 0.35, clamp(wTiny * 0.95, 0.0, 1.0), 0.0);

    // Layer 1: Distant small stars
    renderDepthSlice(col, pTravel, pCross, 48.0, 68.0, 26.0 * u_speed, 0.32, 0.35, 0.75, clamp(wTiny * 0.40 + wSmall * 0.55, 0.0, 1.0), 1.0);

    // Layer 2: Midground small-to-medium stars
    renderDepthSlice(col, pTravel, pCross, 74.0, 105.0, 42.0 * u_speed, 0.55, 0.75, 1.35, clamp(wSmall * 0.70 + wMed * 0.25, 0.0, 1.0), 2.0);

    // Layer 3: Near medium-to-large stars
    renderDepthSlice(col, pTravel, pCross, 115.0, 160.0, 64.0 * u_speed, 0.78, 1.35, 2.10, clamp(wMed * 0.65 + wLarge * 0.30, 0.0, 1.0), 3.0);

    // Layer 4: Foreground large radiant stars streaking rapidly across the field
    renderDepthSlice(col, pTravel, pCross, 180.0, 245.0, 92.0 * u_speed, 1.00, 2.10, 3.50, clamp(wLarge * 0.55, 0.0, 1.0), 4.0);

    fragColor = vec4(col, 1.0) * qt_Opacity;
}
