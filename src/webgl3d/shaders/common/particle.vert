#version 300 es
layout(location = 0) in vec3 a_position; // quad center (world)
layout(location = 1) in vec2 a_uv;       // quad corner offset
layout(location = 2) in vec2 a_size;     // particle size (w, h)
layout(location = 3) in float a_alpha;   // opacity
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform vec3 u_cameraRight;
uniform vec3 u_cameraUp;
out vec2 v_uv;
out float v_alpha;
void main() {
  vec3 worldPos = a_position + u_cameraRight * a_uv.x * a_size.x + u_cameraUp * a_uv.y * a_size.y;
  gl_Position = u_projectionMatrix * u_viewMatrix * vec4(worldPos, 1.0);
  v_uv = a_uv * 0.5 + 0.5;
  v_alpha = a_alpha;
}
