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

// Hyper-optimized single-cell depth slice with early bounding-box bailout
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

    // 1. Identify single cell containing current pixel
    float k = floor(pCross / laneWidth);
    vec4 hLane = hash42(vec2(k * 13.7 + layerId * 37.3, layerId * 91.1 + 17.7));

    // Individual speed variance per lane (±30% jitter)
    float indSpeed = baseSpeed * (0.70 + hLane.y * 0.60);
    float travelShift = u_time * indSpeed + hLane.z * 1000.0;

    float shiftedTravel = pTravel - travelShift;
    float seg = floor(shiftedTravel / segLength);

    // 2. Hash star in this cell
    vec2 cellId = vec2(k * 73.1 + seg * 31.7, layerId * 53.9 + seg * 17.3);
    vec4 hStar = hash42(cellId);

    // Early-out: spawn probability check
    if (hStar.x > spawnProbability) return;

    // Maximum light reach in pixels for early bailout
    float maxReach = (maxRadius >= u_colorThreshold) ? (maxRadius * 6.0) : (maxRadius + 1.2);

    // 3. Early-out: Travel-axis distance check
    float starTravelPos = (seg + hStar.y * 0.70 + 0.15) * segLength + travelShift;
    float dTravel = pTravel - starTravelPos;
    if (abs(dTravel) > maxReach) return; // 99% of pixels exit here in 1 cycle

    // 4. Early-out: Cross-axis distance check with fast triangle-wave drift
    float starCrossPos = (k + hStar.z * 0.70 + 0.15) * laneWidth;
    float driftWave = abs(fract(u_time * (0.25 + hStar.w * 0.35) + hStar.x) * 2.0 - 1.0) * 2.0 - 1.0;
    starCrossPos += driftWave * (depthZ * 1.5);

    float dCross = pCross - starCrossPos;
    if (abs(dCross) > maxReach) return; // Remaining empty pixels exit here

    // 5. Squared Euclidean distance (zero sqrt)
    float dist2 = dTravel * dTravel + dCross * dCross;
    float maxReach2 = maxReach * maxReach;
    if (dist2 > maxReach2) return;

    // ── Pixel is touching a star: compute appearance (runs on < 0.2% of pixels) ──
    float radius = mix(minRadius, maxRadius, hStar.w);
    float radius2 = radius * radius;

    // Fast triangle-wave scintillation / twinkling (zero trigonometric ALU cost)
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

    // Rotated travel & cross coordinates
    vec2 dir = normalize(u_direction);
    vec2 crossDir = vec2(-dir.y, dir.x);

    float pTravel = dot(pixelCoord, dir);
    float pCross  = dot(pixelCoord, crossDir);

    float totalWeight = max(1.0, u_starWeights.x + u_starWeights.y + u_starWeights.z + u_starWeights.w);
    float countFactor = clamp(u_starCount / 444.0, 0.02, 3.0);

    float wTiny  = (u_starWeights.x / totalWeight) * countFactor;
    float wSmall = (u_starWeights.y / totalWeight) * countFactor;
    float wMed   = (u_starWeights.z / totalWeight) * countFactor;
    float wLarge = (u_starWeights.w / totalWeight) * countFactor;

    // ── 6 Hyper-Optimized Parallax Layers ─────────────────────────────────

    // Layer 0: Deep background tiny stars (highest density, slowest drift)
    renderDepthSlice(col, pTravel, pCross, 28.0, 42.0, 16.0 * u_speed, 0.12, 0.15, 0.35, clamp(wTiny * 0.92, 0.0, 1.0), 0.0);

    // Layer 1: Distant tiny-to-small stars
    renderDepthSlice(col, pTravel, pCross, 42.0, 60.0, 24.0 * u_speed, 0.28, 0.30, 0.65, clamp(wTiny * 0.50 + wSmall * 0.45, 0.0, 1.0), 1.0);

    // Layer 2: Midground small stars
    renderDepthSlice(col, pTravel, pCross, 62.0, 88.0, 36.0 * u_speed, 0.46, 0.60, 1.15, clamp(wSmall * 0.80, 0.0, 1.0), 2.0);

    // Layer 3: Near-midground medium stars
    renderDepthSlice(col, pTravel, pCross, 92.0, 130.0, 52.0 * u_speed, 0.65, 1.15, 1.80, clamp(wMed * 0.75, 0.0, 1.0), 3.0);

    // Layer 4: Near large stars with radiant halos
    renderDepthSlice(col, pTravel, pCross, 138.0, 192.0, 72.0 * u_speed, 0.84, 1.80, 2.60, clamp(wLarge * 0.55 + wMed * 0.20, 0.0, 1.0), 4.0);

    // Layer 5: Foreground large stars streaking rapidly across the field
    renderDepthSlice(col, pTravel, pCross, 195.0, 270.0, 98.0 * u_speed, 1.00, 2.60, 3.50, clamp(wLarge * 0.45, 0.0, 1.0), 5.0);

    fragColor = vec4(col, 1.0) * qt_Opacity;
}
