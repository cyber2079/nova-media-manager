#version 300 es
layout(location = 0) in vec3 a_position;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
out vec3 v_texCoord;
void main() {
  v_texCoord = a_position;
  mat4 viewNoTranslate = mat4(mat3(u_viewMatrix)); // strip translation
  vec4 clipPos = u_projectionMatrix * viewNoTranslate * vec4(a_position, 1.0);
  gl_Position = clipPos.xyww; // always at far plane
}
