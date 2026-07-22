#version 300 es
precision highp float;
in vec2 v_uv;
in float v_alpha;
uniform sampler2D u_particleTexture;
uniform vec4 u_color;
out vec4 fragColor;
void main() {
  vec4 tex = texture(u_particleTexture, v_uv);
  fragColor = tex * u_color * vec4(1.0, 1.0, 1.0, v_alpha);
}
