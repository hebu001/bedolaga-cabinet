import { useEffect, useRef } from 'react';

const VERTEX_SRC = `#version 300 es
precision highp float;
in vec4 position;
void main(){gl_Position=position;}`;

// Orange-tinted fbm noise shader — UV scaled to prevent black edges on tall screens
const FRAGMENT_SRC = `#version 300 es
precision highp float;
out vec4 O;
uniform float time;
uniform vec2 resolution;
#define FC gl_FragCoord.xy
#define R resolution
#define T (time+660.)
float rnd(vec2 p) {
  p=fract(p*vec2(12.9898,78.233));
  p+=dot(p,p+34.56);
  return fract(p.x*p.y);
}
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f), k=vec2(1,0);
  float a=rnd(i), b=rnd(i+k), c=rnd(i+k.yx), d=rnd(i+1.);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fbm(vec2 p) {
  float t=.0, a=1., h=.0; mat2 m=mat2(1.,-1.2,.2,1.2);
  for (float i=.0; i<5.; i++) {
    t+=a*noise(p);
    p*=2.*m;
    a*=.5;
    h+=a;
  }
  return t/h;
}
void main() {
  // Normalize UV by the SHORTER axis to prevent black edges
  float mn = min(R.x, R.y);
  vec2 uv = (FC - .5*R) / mn;
  vec2 k = vec2(0, T*.015);
  vec3 col = vec3(1);
  uv *= vec2(1.8, 0.9);
  float n = fbm(uv*.28 + vec2(-T*.01, 0));
  n = noise(uv*3. + n*2.);
  col.r -= fbm(uv + k + n)*.7;
  col.g -= fbm(uv*1.003 + k + n + .003)*.85;
  col.b -= fbm(uv*1.006 + k + n + .006);
  col = mix(col, vec3(1), dot(col, vec3(.21,.71,.07))*.3);
  col *= vec3(1.0, 0.55, 0.15);
  col = mix(vec3(.06), col, min(time*.15, 1.));
  col = clamp(col, .06, .9);
  O = vec4(col, 1);
}`;

export default function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) return;

    const dpr = Math.max(1, Math.min(window.devicePixelRatio, 2)); // Cap DPR for perf

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
      }
      return shader;
    };

    const vs = compile(gl.VERTEX_SHADER, VERTEX_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, 'resolution');
    const uTime = gl.getUniformLocation(program, 'time');

    resize();
    window.addEventListener('resize', resize);

    const loop = (now: number) => {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, now * 1e-3);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
