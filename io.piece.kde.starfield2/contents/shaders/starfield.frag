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

void renderLayer(
    inout vec3 accumColor,
    vec2 pixelCoord,
    float cellSize,
    float speedPx,
    float minRadius,
    float maxRadius,
    float spawnProbability,
    vec2 seedOffset
) {
    if (spawnProbability <= 0.001) return;

    // Shift coordinates by travel direction and speed
    vec2 layerOffset = u_direction * (u_time * speedPx);
    vec2 pos = pixelCoord - layerOffset;

    vec2 cell = floor(pos / cellSize);

    // Check 3x3 neighboring cells to ensure stars spanning cell boundaries are never clipped
    for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
            vec2 currentCell = cell + vec2(float(dx), float(dy));
            vec4 h = hash42(currentCell + seedOffset);

            // Determine if star exists in this cell
            if (h.x > spawnProbability) continue;

            // Star position in world pixel space
            vec2 starCenter = (currentCell + h.yz * 0.8 + 0.1) * cellSize + layerOffset;
            float dist = length(pixelCoord - starCenter);

            // Radius and opacity
            float radius = mix(minRadius, maxRadius, h.w);
            float opacity = 0.4 + h.y * 0.6;

            // Color
            vec3 col;
            bool hasGlow = (radius >= u_colorThreshold);
            if (hasGlow) {
                col = spectralColor(h.z, h.wx);
            } else {
                col = vec3(0.72 + h.z * 0.28);
            }

            // Core brightness with sub-pixel antialiasing
            float core = smoothstep(radius + 0.5, max(0.0, radius - 0.5), dist) * opacity;

            // Soft radial glow for larger stars (radius * 12 diameter, 3-stop falloff)
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
    vec3 col = vec3(0.0); // Black space background

    float totalWeight = max(1.0, u_starWeights.x + u_starWeights.y + u_starWeights.z + u_starWeights.w);
    float countFactor = clamp(u_starCount / 444.0, 0.02, 3.0);

    // Layer 0: Tiny stars (r 0.15–0.50, dense, slowest)
    float tinyProb = clamp((u_starWeights.x / totalWeight) * 4.0 * countFactor * 0.85, 0.0, 1.0);
    renderLayer(col, pixelCoord, 38.0, 20.0 * u_speed, 0.15, 0.50, tinyProb, vec2(13.1, 47.7));

    // Layer 1: Small stars (r 0.50–1.30, moderate speed)
    float smallProb = clamp((u_starWeights.y / totalWeight) * 4.0 * countFactor * 0.70, 0.0, 1.0);
    renderLayer(col, pixelCoord, 65.0, 35.0 * u_speed, 0.50, 1.30, smallProb, vec2(71.3, 93.9));

    // Layer 2: Medium stars (r 1.30–2.00, faster)
    float medProb = clamp((u_starWeights.z / totalWeight) * 4.0 * countFactor * 0.55, 0.0, 1.0);
    renderLayer(col, pixelCoord, 110.0, 55.0 * u_speed, 1.30, 2.00, medProb, vec2(137.5, 269.1));

    // Layer 3: Large stars (r 2.00–3.50, rarest, fastest, vibrant glow)
    float largeProb = clamp((u_starWeights.w / totalWeight) * 4.0 * countFactor * 0.40, 0.0, 1.0);
    renderLayer(col, pixelCoord, 190.0, 80.0 * u_speed, 2.00, 3.50, largeProb, vec2(311.2, 571.8));

    fragColor = vec4(col, 1.0) * qt_Opacity;
}
