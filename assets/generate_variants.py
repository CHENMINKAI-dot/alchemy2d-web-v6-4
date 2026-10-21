"""Generate deterministic stone color variants from the authored crystal illustrations.
Gold filigree is intentionally preserved. Optional regeneration utility.
Requires pillow and numpy and opencv-python, but the website itself requires none.
"""
from pathlib import Path
from PIL import Image
import cv2
import numpy as np
P = Path(__file__).parent
TARGETS = {'blue': 107, 'purple': 141, 'rose': 169}  # OpenCV HSV hue in 0..179
for shape in ('round', 'faceted', 'spire'):
    original = np.array(Image.open(P/f'stone_{shape}.png').convert('RGBA'))
    rgb=original[:,:,:3]
    alpha=original[:,:,3]
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV)
    h,s,v=cv2.split(hsv)
    # Keep gold & pale silver specular highlights unmodified. Tint purple/violet pixels.
    original_h = h.copy()
    mask=(alpha>0)&(h>=112)&(h<=174)&(s>=36)
    for label, target in TARGETS.items():
        hh=original_h.astype(np.float32)
        shifted = np.round(hh + (target - 143)).astype(np.int16)%180
        shifted = shifted.astype(np.uint8)
        h2 = np.where(mask, shifted, h)
        hsv2=np.dstack([h2,s,v]).astype(np.uint8)
        out=cv2.cvtColor(hsv2,cv2.COLOR_HSV2RGB)
        final=np.dstack([out,alpha])
        Image.fromarray(final,'RGBA').save(P/f'stone_{shape}_{label}.png',optimize=True)
        print(f'stone_{shape}_{label}.png')
