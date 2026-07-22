#version 300 es
precision highp float;
in vec3 v_texCoord;
uniform samplerCube u_skybox;
out vec4 fragColor;
void main() {
  fragColor = texture(u_skybox, v_texCoord);
}
