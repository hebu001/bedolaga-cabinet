import React, { useEffect, useRef, useCallback } from 'react';
import { useAnimationPause } from '@/hooks/useAnimationLoop';
import { sanitizeColor, clampNumber } from './types';

interface Props {
  settings: Record<string, unknown>;
}

// ── GLSL shaders ────────────────────────────────────────────────────────────────

const VERTEX_SRC = `#version 300 es
precision highp float;
in vec4 position;
void main(){gl_Position=position;}`;

// Classic 3D Perlin noise (Stefan Gustavson) + color-tinted output
const FRAGMENT_SRC = `#version 300 es
precision highp float;
out vec4 O;
uniform float time;
uniform float deltaY;
uniform vec2 resolution;
uniform vec3 tintColor;

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
vec3 fade(vec3 t){return t*t*t*(t*(t*6.0-15.0)+10.0);}

float cnoise(vec3 P){
  vec3 Pi0=floor(P);
  vec3 Pi1=Pi0+vec3(1.0);
  Pi0=mod289(Pi0);
  Pi1=mod289(Pi1);
  vec3 Pf0=fract(P);
  vec3 Pf1=Pf0-vec3(1.0);
  vec4 ix=vec4(Pi0.x,Pi1.x,Pi0.x,Pi1.x);
  vec4 iy=vec4(Pi0.yy,Pi1.yy);
  vec4 iz0=Pi0.zzzz;
  vec4 iz1=Pi1.zzzz;
  vec4 ixy=permute(permute(ix)+iy);
  vec4 ixy0=permute(ixy+iz0);
  vec4 ixy1=permute(ixy+iz1);
  vec4 gx0=ixy0*(1.0/7.0);
  vec4 gy0=fract(floor(gx0)*(1.0/7.0))-0.5;
  gx0=fract(gx0);
  vec4 gz0=vec4(0.5)-abs(gx0)-abs(gy0);
  vec4 sz0=step(gz0,vec4(0.0));
  gx0-=sz0*(step(0.0,gx0)-0.5);
  gy0-=sz0*(step(0.0,gy0)-0.5);
  vec4 gx1=ixy1*(1.0/7.0);
  vec4 gy1=fract(floor(gx1)*(1.0/7.0))-0.5;
  gx1=fract(gx1);
  vec4 gz1=vec4(0.5)-abs(gx1)-abs(gy1);
  vec4 sz1=step(gz1,vec4(0.0));
  gx1-=sz1*(step(0.0,gx1)-0.5);
  gy1-=sz1*(step(0.0,gy1)-0.5);
  vec3 g000=vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100=vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010=vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110=vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001=vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101=vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011=vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111=vec3(gx1.w,gy1.w,gz1.w);
  vec4 norm0=taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
  g000*=norm0.x; g010*=norm0.y; g100*=norm0.z; g110*=norm0.w;
  vec4 norm1=taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
  g001*=norm1.x; g011*=norm1.y; g101*=norm1.z; g111*=norm1.w;
  float n000=dot(g000,Pf0);
  float n100=dot(g100,vec3(Pf1.x,Pf0.yz));
  float n010=dot(g010,vec3(Pf0.x,Pf1.y,Pf0.z));
  float n110=dot(g110,vec3(Pf1.xy,Pf0.z));
  float n001=dot(g001,vec3(Pf0.xy,Pf1.z));
  float n101=dot(g101,vec3(Pf1.x,Pf0.y,Pf1.z));
  float n011=dot(g011,vec3(Pf0.x,Pf1.yz));
  float n111=dot(g111,Pf1);
  vec3 fade_xyz=fade(Pf0);
  vec4 n_z=mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fade_xyz.z);
  vec2 n_yz=mix(n_z.xy,n_z.zw,fade_xyz.y);
  float n_xyz=mix(n_yz.x,n_yz.y,fade_xyz.x);
  return 2.2*n_xyz;
}

void main(){
  vec2 pos=(gl_FragCoord.xy/1024.0)+vec2(0.0,deltaY);
  float n=0.0;
  for(float i=1.0;i<=3.0;i++){
    n+=cnoise(i*(n+vec3(pos,n+time)))/i;
  }
  float brightness=1.0-abs(sin(1.0-n*2.0));
  vec3 col=tintColor*brightness;
  O=vec4(col,1.0);
}`;

// ── Helpers ─────────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  const num = parseInt(c.length === 3 ? c.split('').map(h => h + h).join('') : c, 16);
  return [(num >> 16 & 255) / 255, (num >> 8 & 255) / 255, (num & 255) / 255];
}

// ── Component ───────────────────────────────────────────────────────────────────

export default React.memo(function BackgroundBeamsCollision({ settings }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const tickRef = useRef(Math.round(Math.random() * 5000));
  const deltaYRef = useRef(0);
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
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
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
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return undefined;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, 'time');
    const uDeltaY = gl.getUniformLocation(program, 'deltaY');
    const uResolution = gl.getUniformLocation(program, 'resolution');
    const uTintColor = gl.getUniformLocation(program, 'tintColor');

    resize();
    window.addEventListener('resize', resize);

    const loop = () => {
      if (pausedRef.current) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const s = settingsRef.current;
      const speed = clampNumber(s.speed, 0.1, 2.0, 1.0);
      const colorHex = sanitizeColor(s.shaderColor, '#4169E1');
      const [r, g, b] = hexToRgb(colorHex);

      tickRef.current++;
      deltaYRef.current -= 0.0005 * speed;

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.uniform1f(uTime, 0.00025 * tickRef.current * speed);
      gl.uniform1f(uDeltaY, deltaYRef.current);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform3f(uTintColor, r, g, b);
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

  useEffect(() => {
    return setupGL();
  }, [setupGL]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
      style={{ width: '100%', height: '100%' }}
    />
  );
});
