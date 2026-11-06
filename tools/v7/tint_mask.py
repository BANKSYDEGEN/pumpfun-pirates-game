from PIL import Image,ImageFilter
import numpy as np
im=Image.open('/workspace/v7-meshy/out/male_v7_tex_0_base_color_fixed.png').convert('RGB').resize((2048,2048))
hsv=np.asarray(im.convert('HSV')).astype(float)/255;h,s,v=hsv.transpose(2,0,1)
skin=(h>.015)&(h<.09)&(s>.16)&(v>.20)
hair=(h>=.09)&(h<.19)&(s>.22)&(v>.16)
eye=(h>.515)&(h<.70)&(s>.45)&(v>.14)
# Pill has a teal hue < .515: NONE of its pixels are skin/hair/iris tint keys.
mask=np.asarray(Image.fromarray(np.stack([skin,hair,eye],2).astype('uint8')*255).filter(ImageFilter.GaussianBlur(.35))).copy()
protected=((h>=.30)&(h<=.515)&(s>.15))|(v<.12)
mask[protected]=0
assert not mask[protected].any(), 'Pill / ink must not be tinted'
Image.fromarray(mask).save('assets/pirates/v7_male_tint.webp',lossless=True)

Image.open('assets/pirates/v7_male_tint.webp').resize((1024,1024)).save('assets/pirates/v7_male_tint_lo.webp',lossless=True)
