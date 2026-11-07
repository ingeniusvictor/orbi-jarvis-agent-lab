/**
 * VISION-02.2: advisory-only webcam signal check. Small local sampling during
 * the owner-opened preview, not continuous video analysis, upload or storage.
 * A dark image may also be legitimate: NEVER block owner-approved analysis.
 */
export function predominantlyDarkCameraSignal(
  rgba:ArrayLike<number>,
  darkThreshold=.94,
):boolean{
  if(!rgba || rgba.length<16 || rgba.length%4!==0)return false
  let dark=0,bright=0
  const pixels=rgba.length/4
  for(let i=0;i<rgba.length;i+=4){
    const r=rgba[i],g=rgba[i+1],b=rgba[i+2]
    if(Math.max(r,g,b)<36)dark++
    if(Math.min(r,g,b)>195)bright++
  }
  // Phone Link's unavailable camera may draw a white device icon in
  // an otherwise black frame. This is a warning, not proof of its source.
  return dark/pixels>=darkThreshold && bright/pixels<.075
}
export function inspectCameraSignal(video:HTMLVideoElement):string|null{
  if(video.videoWidth<=0 || video.videoHeight<=0 || video.readyState<2)return null
  try{
    const canvas=document.createElement('canvas')
    canvas.width=48
    canvas.height=27
    const ctx=canvas.getContext('2d',{willReadFrequently:true})
    if(!ctx)return null
    ctx.drawImage(video,0,0,48,27)
    const pixels=ctx.getImageData(0,0,48,27).data
    return predominantlyDarkCameraSignal(pixels)
      ? 'La señal es casi negra. Puede ser privacidad, una cámara virtual o poca luz. Prueba otra cámara.'
      : null
  }catch{
    return null // Browsers with restricted canvas access may still show video.
  }
}
export function connectedOrVirtualCameraHint(label:string):string|null{
  if(/(?:phone|android|movil|m[oó]vil|virtual|connected camera|enlace m[oó]vil|camo|obs|droidcam)/i.test(label)){
    return 'Parece una cámara móvil o virtual. Si no ves el entorno, elige la webcam integrada.'
  }
  return null
}
