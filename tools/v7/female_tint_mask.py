# [Emerly V7 female] recolour mask (R skin, G hair, B iris) for a PICKED skin / hair / eye colour only. Default look = Meshy paint, untinted.
from PIL import Image,ImageFilter
import numpy as np
im=Image.open('/workspace/v7-meshy/out/female_v7_tex_0_base_color.png').convert('RGB')
hsv=np.asarray(im.convert('HSV')).astype(float)/255;h,s,v=hsv.transpose(2,0,1)
skin=(h>.015)&(h<.09)&(s>.16)&(v>.20)
hair=(h>=.09)&(h<.19)&(s>.22)&(v>.16)
eye=(h>.515)&(h<.70)&(s>.45)&(v>.14)
mask=np.asarray(Image.fromarray(np.stack([skin,hair,eye],2).astype('uint8')*255).filter(ImageFilter.GaussianBlur(.35))).copy()
mask[v<.12]=0
Image.fromarray(mask).save('assets/pirates/v7_female_tint.webp',lossless=True)
Image.fromarray(mask).resize((1024,1024)).save('assets/pirates/v7_female_tint_lo.webp',lossless=True)
print('skin',skin.mean(),'hair',hair.mean(),'eye',eye.mean())
