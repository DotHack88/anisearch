import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { getCroppedImg } from '../utils/cropImage'

export default function ImageCropper({ imageSrc, onCropComplete, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

  const handleCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleSave = async () => {
    try {
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels)
      onCropComplete(croppedImageBlob)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-surface border border-border/50 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col h-[80vh] sm:h-[600px]">
        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-surface/80">
          <h3 className="font-semibold text-text">Ritaglia Immagine</h3>
          <button type="button" onClick={onCancel} className="text-text-dim hover:text-text text-xl leading-none">&times;</button>
        </div>
        
        <div className="relative flex-1 bg-black/50">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onCropComplete={handleCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        <div className="p-4 bg-surface border-t border-border/50 space-y-4">
          <div>
            <label className="text-xs text-text-dim block mb-2 font-medium">Zoom</label>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-label="Zoom"
              onChange={(e) => setZoom(e.target.value)}
              className="w-full accent-accent"
            />
          </div>
          <div className="flex gap-3 justify-end mt-4">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-semibold border border-border text-text-dim hover:text-text hover:bg-white/5 transition-all">Annulla</button>
            <button type="button" onClick={handleSave} className="px-4 py-2 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-all shadow-lg shadow-accent/20">Conferma Ritaglio</button>
          </div>
        </div>
      </div>
    </div>
  )
}
