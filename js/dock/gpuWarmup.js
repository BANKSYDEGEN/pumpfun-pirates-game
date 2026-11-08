// Loading-cover only: move shader reflection / first texture uploads out of walking.
// Uses the actual scene lights/environment; never changes art, exposure or visibility.
const reflected = new WeakMap();
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
export async function warmBuildingGPU({renderer,scene,camera,roots=[],textures=[],collectTextures=false,timeoutMs=15000}) {
 const started=performance.now(),report={programs:0,textures:0,ms:0};
 if(!renderer||renderer.getContext?.().isContextLost?.())return report;
 let seen=reflected.get(renderer);if(!seen){seen=new WeakSet();reflected.set(renderer,seen);}
 const unique=[...new Set(roots.filter(Boolean))], maps=new Set(textures.filter(Boolean));
 for(const root of unique){root.updateWorldMatrix?.(true,true);
  if(renderer.compileAsync){let timer;const ready=await Promise.race([Promise.resolve().then(()=>renderer.compileAsync(root,camera,scene)).then(()=>true),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),timeoutMs);})]).finally(()=>clearTimeout(timer));
   if(!ready){report.timedOut=true;report.ms=Math.round(performance.now()-started);return report;}
  }else renderer.compile?.(root,camera,scene);
  if(renderer.getContext?.().isContextLost?.())break;
  // r165 defers ACTIVE_UNIFORMS/attributes reflection until first use, even after
  // compile(). Force its cached reflection while the harbor loading cover is up.
  for(const p of renderer.info?.programs||[]){if(seen.has(p))continue;p.getUniforms?.();p.getAttributes?.();seen.add(p);report.programs++;}
  if(collectTextures)root.traverse?.(o=>{for(const m of [].concat(o.material||[]))for(const k of Object.keys(m))if(m[k]?.isTexture&&!m[k].isRenderTargetTexture)maps.add(m[k]);});
  await pause();
 }
 for(const t of maps){if(renderer.getContext?.().isContextLost?.())break;const im=t.image;if(!im||(!(im.width&&im.height)&&!t.mipmaps?.length))continue;
  renderer.initTexture?.(t);report.textures++;await pause();
 }
 report.ms=Math.round(performance.now()-started);return report;
}
