(() => {
  'use strict';
  const cache = new Map();
  const loadImage = src => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('石碑图像未能载入'));
    image.src = src;
  });
  window.loadSteleArt = design => {
    if (cache.has(design.id)) return cache.get(design.id);
    const data = window.STELE_RENDER_DATA?.designs[design.id];
    if (!data || data.tiles.length !== 8) return Promise.reject(new Error('石碑图像尚未准备好'));
    const maskSrc=data.maskSrc||data.mask?.src;
    const sources=[...data.tiles,data.base];
    if(maskSrc)sources.push({src:maskSrc});
    const loading = Promise.all(sources.map(async sprite => ({
      ...sprite, image: await loadImage(sprite.src)
    }))).then(sprites => {
      const glyphMask = Object.assign(document.createElement('canvas'), {width:480,height:960});
      const glyph = glyphMask.getContext('2d');
      let maskSource=null;
      if(maskSrc){
        maskSource=sprites[9].image;
        if((data.maskFormat||data.mask?.format)==='luminance'){
          const alpha=document.createElement('canvas');alpha.width=maskSource.naturalWidth;alpha.height=maskSource.naturalHeight;
          const ac=alpha.getContext('2d');ac.drawImage(maskSource,0,0);
          const pixels=ac.getImageData(0,0,alpha.width,alpha.height);
          for(let i=0;i<pixels.data.length;i+=4)pixels.data[i+3]=pixels.data[i]*pixels.data[i+3]/255;
          ac.putImageData(pixels,0,0);maskSource=alpha;
        }
        glyph.drawImage(maskSource,0,0,480,960);
        return {tiles:sprites.slice(0,8),base:sprites[8],glyphMask,maskSource,topProfile:data.topProfile};
      }
      glyph.scale(2,2);glyph.fillStyle='#000';glyph.strokeStyle='#000';glyph.lineJoin='round';
      const layout = design.layout || design.paths.map((path,i)=>({path,x:15,y:i?245:24,size:210}));
      for(const item of layout){
        glyph.save();glyph.translate(item.x,item.y);glyph.scale(item.size/500,item.size/500);
        const path = new Path2D(item.path);glyph.fill(path);
        if(layout.length>3){glyph.lineWidth=.38*500/item.size;glyph.stroke(path);}
        glyph.restore();
      }
      return {tiles:sprites.slice(0,8),base:sprites[8],glyphMask,topProfile:data.topProfile};
    }).catch(error=>{cache.delete(design.id);throw error;});
    if(cache.size>=2)cache.delete(cache.keys().next().value);
    cache.set(design.id, loading);
    return loading;
  };
})();
