#version 300 es
// Standard PBR metallic-roughness forward fragment shader
// Ref: [06_着色器 §3.2]

precision highp float;

in vec3 v_worldPos;
in vec3 v_normal;
in vec2 v_uv;

uniform vec3 u_cameraPosition;
uniform vec4 u_baseColorFactor;
uniform float u_metallicFactor;
uniform float u_roughnessFactor;
uniform sampler2D u_baseColorTexture;
uniform sampler2D u_metallicRoughnessTexture;
uniform sampler2D u_normalTexture;

// Lighting
struct Light {
  vec3 direction;
  vec3 color;
  float intensity;
};
uniform Light u_lights[4];
uniform int u_lightCount;

out vec4 fragColor;

const float PI = 3.14159265359;

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

float distributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float denom = NdotH * NdotH * (a2 - 1.0) + 1.0;
  return a2 / (PI * denom * denom);
}

float geometrySchlickGGX(float NdotV, float roughness) {
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  return geometrySchlickGGX(max(dot(N, V), 0.0), roughness) *
         geometrySchlickGGX(max(dot(N, L), 0.0), roughness);
}

void main() {
  vec4 baseColor = u_baseColorFactor * texture(u_baseColorTexture, v_uv);
  vec3 mr = texture(u_metallicRoughnessTexture, v_uv).rgb;
  float metallic = mr.b * u_metallicFactor;
  float roughness = max(mr.g * u_roughnessFactor, 0.04);

  // Tangent-space normal
  vec3 N = normalize(v_normal);

  vec3 V = normalize(u_cameraPosition - v_worldPos);
  vec3 F0 = mix(vec3(0.04), baseColor.rgb, metallic);

  vec3 Lo = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    if (i >= u_lightCount) break;
    vec3 L = normalize(-u_lights[i].direction);
    vec3 H = normalize(V + L);
    vec3 radiance = u_lights[i].color * u_lights[i].intensity;

    float NDF = distributionGGX(N, H, roughness);
    float G = geometrySmith(N, V, L, roughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
    vec3 specular = numerator / denominator;

    vec3 kD = (1.0 - F) * (1.0 - metallic);
    float NdotL = max(dot(N, L), 0.0);
    Lo += (kD * baseColor.rgb / PI + specular) * radiance * NdotL;
  }

  // Ambient
  vec3 ambient = vec3(0.03) * baseColor.rgb;

  fragColor = vec4(ambient + Lo, baseColor.a);
}
