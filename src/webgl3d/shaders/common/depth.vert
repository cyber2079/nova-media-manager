#version 300 es
layout(location = 0) in vec3 a_position;
uniform mat4 u_modelMatrix;
uniform mat4 u_lightViewProj;
void main() {
  gl_Position = u_lightViewProj * u_modelMatrix * vec4(a_position, 1.0);
}
