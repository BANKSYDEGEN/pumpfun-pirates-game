"""Bake the existing altar's gold V7 statue; serve repo on localhost first."""
import asyncio, base64, io
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = await browser.new_page()
        await page.goto('http://127.0.0.1:8896/tools/v7/qa.html')
        data = await page.evaluate('''async () => {
          const THREE = await import('three');
          const {loadPirateGLB} = await import('/js/pirateGLB.js');
          const gl = await loadPirateGLB('/assets/pirates/pirate_male_v7_lo.glb');
          const model = gl.scene;
          const clip = gl.animations.find(a => a.name === 'idle') || gl.animations[0];
          if (clip) { const mixer = new THREE.AnimationMixer(model); mixer.clipAction(clip).play(); mixer.update(.6); }
          const gold = new THREE.MeshStandardMaterial({color:0xffc24a,metalness:1,roughness:.28,emissive:0x4a2c00,emissiveIntensity:.55});
          model.traverse(o => {if(o.isMesh){o.material=gold;o.frustumCulled=false;}});
          model.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
          model.position.sub(center);
          const scene = new THREE.Scene(); scene.add(model);
          const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true}); renderer.setSize(512,512);
          renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
          const pmrem = new THREE.PMREMGenerator(renderer); const env = new THREE.Scene(); env.background = new THREE.Color(0x706044);
          for (const [x,y,z,w,h,power] of [[-3,3,4,4,6,5],[4,1,2,2,5,3],[0,5,-2,4,3,4]]) {
            const panel = new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(power,power*.9,power*.7),side:THREE.DoubleSide}));
            panel.position.set(x,y,z);panel.lookAt(0,0,0);env.add(panel);
          }
          scene.environment = pmrem.fromScene(env, .04).texture;
          scene.add(new THREE.HemisphereLight(0xffefce,0x49301b,2));
          const light = new THREE.DirectionalLight(0xffe6a0,4);light.position.set(-3,4,5);scene.add(light);
          const cam = new THREE.PerspectiveCamera(30,1,.01,100); const d = Math.max(size.y, size.x)*.57/Math.tan(Math.PI/12);
          cam.position.set(d*.28,size.y*.08,d);cam.lookAt(0,0,0);
          renderer.render(scene,cam); const png = renderer.domElement.toDataURL(); renderer.dispose();pmrem.dispose(); return png;
        }''')
        image = Image.open(io.BytesIO(base64.b64decode(data.split(',')[1]))).resize((256,256), Image.Resampling.LANCZOS)
        out = ROOT/'assets/items/val_golden_idol.webp'
        image.save(out, 'WEBP', quality=88, method=6)
        print(out, out.stat().st_size)
        await browser.close()
asyncio.run(main())
