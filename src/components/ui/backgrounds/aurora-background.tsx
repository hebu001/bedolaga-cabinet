import { useEffect, useRef, useCallback } from 'react';
import { useAnimationPause } from '@/hooks/useAnimationLoop';
import { sanitizeColor } from './types';

const VERTEX_SRC = `#version 300 es
precision highp float;
in vec4 position;
void main(){gl_Position=position;}`;

const FRAGMENT_SRC = `#version 300 es
precision highp float;
out vec4 O;
uniform float time;
uniform vec2 resolution;
uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
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
  // Blend three user colors based on noise position
  float blend = col.r * 0.33 + col.g * 0.33 + col.b * 0.34;
  vec3 tint = mix(color1, color2, smoothstep(0.2, 0.5, blend));
  tint = mix(tint, color3, smoothstep(0.5, 0.8, blend));
  col *= tint;
  col = mix(vec3(.06), col, min(time*.15, 1.));
  col = clamp(col, .06, .9);
  O = vec4(col, 1);
}`;

interface Props {
  settings: Record<string, unknown>;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  const num = parseInt(
    c.length === 3
      ? c
          .split('')
          .map((h) => h + h)
          .join('')
      : c,
    16,
  );
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

const SPEED_MAP: Record<string, number> = { slow: 0.5, normal: 1.0, fast: 2.0 };

export default function AuroraBackground({ settings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const paused = useAnimationPause();
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const setupGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) return undefined;

    const dpr = Math.max(1, Math.min(window.devicePixelRatio, 2));

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : window.innerWidth;
      const h = parent ? parent.clientHeight : window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
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
      return undefined;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, 'resolution');
    const uTime = gl.getUniformLocation(program, 'time');
    const uColor1 = gl.getUniformLocation(program, 'color1');
    const uColor2 = gl.getUniformLocation(program, 'color2');
    const uColor3 = gl.getUniformLocation(program, 'color3');

    resize();

    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const loop = (now: number) => {
      if (pausedRef.current) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const s = settingsRef.current;
      const speedKey = typeof s.speed === 'string' ? s.speed : 'normal';
      const speedMul = SPEED_MAP[speedKey] ?? 1.0;

      const c1 = hexToRgb(sanitizeColor(s.firstColor, '#00d2ff'));
      const c2 = hexToRgb(sanitizeColor(s.secondColor, '#7928ca'));
      const c3 = hexToRgb(sanitizeColor(s.thirdColor, '#ff0080'));

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, now * 1e-3 * speedMul);
      gl.uniform3f(uColor1, c1[0], c1[1], c1[2]);
      gl.uniform3f(uColor2, c2[0], c2[1], c2[2]);
      gl.uniform3f(uColor3, c3[0], c3[1], c3[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  useEffect(() => {
    return setupGL();
  }, [setupGL]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
