#version 300 es
// Standard PBR forward-rendering vertex shader
// Common to all themes. Included in client, not packed in NV3D.
// Ref: [06_着色器 §3](docs/webgl3d-spec/06_着色器开发通用规范.md)

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;

uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform mat4 u_normalMatrix;

out vec3 v_worldPos;
out vec3 v_normal;
out vec2 v_uv;

void main() {
  vec4 worldPos = u_modelMatrix * vec4(a_position, 1.0);
  v_worldPos = worldPos.xyz;
  v_normal = normalize(mat3(u_normalMatrix) * a_normal);
  v_uv = a_uv;
  gl_Position = u_projectionMatrix * u_viewMatrix * worldPos;
}
