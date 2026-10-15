'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { uploadToCloudinary } from '@/lib/cloudinaryUpload'
import { Upload, X, ArrowLeft, ArrowRight, Star, RefreshCw, AlertCircle, Loader2 } from 'lucide-react'

export interface PhotoCardItem {
  id: string
  url: string              // Local object URL for instant preview OR remote Cloudinary URL
  remoteUrl?: string       // Cloudinary URL once uploaded
  file?: File              // File object if upload is pending or failed
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

interface ProductPhotoUploaderProps {
  photos: string[]
  onChange: (photos: string[]) => void
  onUploadingChange?: (isUploading: boolean) => void
  maxPhotos?: number
  label?: string
  description?: string
  disabled?: boolean
}

const MAX_CONCURRENT_UPLOADS = 3

export function ProductPhotoUploader({
  photos = [],
  onChange,
  onUploadingChange,
  maxPhotos = 20,
  label = 'Product photos',
  description = 'Upload multiple angles. First photo is the cover shown in catalog and jeweler portal.',
  disabled = false,
}: ProductPhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const objectUrlsRef = useRef<Set<string>>(new Set())

  // Internal state tracking both existing remote URLs and pending/uploading local items
  const [items, setItems] = useState<PhotoCardItem[]>(() =>
    photos.map((url, i) => ({
      id: `init_${i}_${url}`,
      url,
      remoteUrl: url,
      status: 'done',
    }))
  )

  // Track parent sync: when photos prop changes externally (e.g. initial fetch on edit page)
  const lastPhotosPropRef = useRef<string[]>(photos)
  useEffect(() => {
    // Only resync if the photos array content actually changed from outside
    const currentRemoteUrls = items.filter(it => it.status === 'done' && it.remoteUrl).map(it => it.remoteUrl!)
    const hasChanged =
      photos.length !== lastPhotosPropRef.current.length ||
      photos.some((url, idx) => url !== lastPhotosPropRef.current[idx])

    if (hasChanged) {
      lastPhotosPropRef.current = photos
      // If parent updated from database or outside, reconcile items
      const isDifferentFromItems =
        photos.length !== currentRemoteUrls.length ||
        photos.some((url, idx) => url !== currentRemoteUrls[idx])

      if (isDifferentFromItems) {
        setItems(prev => {
          // Keep any currently uploading items, merge with remote photos
          const inFlight = prev.filter(it => it.status === 'uploading' || it.status === 'pending')
          const syncedDone: PhotoCardItem[] = photos.map((url, i) => {
            const existing = prev.find(p => p.remoteUrl === url)
            return existing || {
              id: `synced_${i}_${url}`,
              url,
              remoteUrl: url,
              status: 'done',
            }
          })
          return [...syncedDone, ...inFlight]
        })
      }
    }
  }, [photos, items])

  // Cleanup object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url)
        } catch {}
      })
      objectUrlsRef.current.clear()
    }
  }, [])

  // Notify parent of uploading state
  const isAnyUploading = items.some(it => it.status === 'uploading' || it.status === 'pending')
  useEffect(() => {
    if (onUploadingChange) {
      onUploadingChange(isAnyUploading)
    }
  }, [isAnyUploading, onUploadingChange])

  // Emit updated photos array to parent whenever done remote URLs change order or content
  const emitChange = useCallback((updatedItems: PhotoCardItem[]) => {
    const validUrls = updatedItems
      .filter((it): it is PhotoCardItem & { remoteUrl: string } => it.status === 'done' && Boolean(it.remoteUrl))
      .map(it => it.remoteUrl)

    lastPhotosPropRef.current = validUrls
    onChange(validUrls)
  }, [onChange])

  // Concurrency queue processor using activeUploadsRef worker pool
  const activeUploadsRef = useRef<Set<string>>(new Set())

  const startUpload = useCallback(async (item: PhotoCardItem) => {
    if (!item.file || activeUploadsRef.current.has(item.id)) return
    activeUploadsRef.current.add(item.id)

    // Set card status to uploading
    setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'uploading', error: undefined } : it))

    try {
      const remoteUrl = await uploadToCloudinary(item.file)

      // Revoke the temporary local object URL preview
      if (item.url && item.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(item.url)
          objectUrlsRef.current.delete(item.url)
        } catch {}
      }

      setItems(prev => {
        const next = prev.map(it => {
          if (it.id === item.id) {
            return {
              ...it,
              url: remoteUrl,
              remoteUrl,
              status: 'done' as const,
              file: undefined,
              error: undefined,
            }
          }
          return it
        })
        emitChange(next)
        return next
      })
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err || 'Upload failed')
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'error', error: msg } : it))
    } finally {
      activeUploadsRef.current.delete(item.id)
    }
  }, [emitChange])

  // Queue runner effect: whenever items change or active uploads complete, schedule next pending items
  useEffect(() => {
    const activeCount = activeUploadsRef.current.size
    const availableSlots = MAX_CONCURRENT_UPLOADS - activeCount
    if (availableSlots <= 0) return

    const pending = items.filter(it => it.status === 'pending' && !activeUploadsRef.current.has(it.id))
    const toStart = pending.slice(0, availableSlots)
    for (const item of toStart) {
      startUpload(item)
    }
  }, [items, startUpload])

  // Handle incoming file selection
  const handleFiles = useCallback((selectedFiles: FileList | File[] | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return

    const incoming = Array.from(selectedFiles)
    const currentCount = items.length
    const availableSlots = Math.max(0, maxPhotos - currentCount)

    if (availableSlots <= 0) {
      alert(`Maximum of ${maxPhotos} photos reached. Remove an existing photo to upload new ones.`)
      return
    }

    const filesToProcess = incoming.slice(0, availableSlots)
    const newCards: PhotoCardItem[] = []

    for (const file of filesToProcess) {
      // Validate file type
      const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|avif|heic)$/i.test(file.name)
      if (!isImg) {
        continue
      }

      // Create instant local object URL preview
      let localUrl = ''
      try {
        localUrl = URL.createObjectURL(file)
        objectUrlsRef.current.add(localUrl)
      } catch {
        localUrl = ''
      }

      const cardId = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

      // Size check (25 MB max)
      if (file.size > 25 * 1024 * 1024) {
        newCards.push({
          id: cardId,
          url: localUrl,
          file,
          status: 'error',
          error: 'File exceeds 25 MB limit.',
        })
      } else {
        newCards.push({
          id: cardId,
          url: localUrl,
          file,
          status: 'pending',
        })
      }
    }

    if (newCards.length > 0) {
      setItems(prev => [...prev, ...newCards])
    }
  }, [items.length, maxPhotos])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    // CRITICAL: Clear file input value so re-selecting the same file or adding batches works
    if (e.target) {
      e.target.value = ''
    }
  }

  // Remove photo
  const handleRemove = (id: string) => {
    activeUploadsRef.current.delete(id)
    setItems(prev => {
      const target = prev.find(it => it.id === id)
      if (target?.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(target.url)
          objectUrlsRef.current.delete(target.url)
        } catch {}
      }
      const next = prev.filter(it => it.id !== id)
      emitChange(next)
      return next
    })
  }

  // Move photo left (toward cover)
  const handleMoveLeft = (index: number) => {
    if (index <= 0) return
    setItems(prev => {
      const copy = [...prev]
      const temp = copy[index - 1]
      copy[index - 1] = copy[index]
      copy[index] = temp
      emitChange(copy)
      return copy
    })
  }

  // Move photo right
  const handleMoveRight = (index: number) => {
    if (index >= items.length - 1) return
    setItems(prev => {
      const copy = [...prev]
      const temp = copy[index + 1]
      copy[index + 1] = copy[index]
      copy[index] = temp
      emitChange(copy)
      return copy
    })
  }

  // Make cover (move to position 0)
  const handleMakeCover = (index: number) => {
    if (index <= 0) return
    setItems(prev => {
      const copy = [...prev]
      const [item] = copy.splice(index, 1)
      copy.unshift(item)
      emitChange(copy)
      return copy
    })
  }

  // Retry failed item
  const handleRetry = (id: string) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id === id) {
          return { ...it, status: 'pending', error: undefined }
        }
        return it
      })
    )
  }

  const atLimit = items.length >= maxPhotos

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4 lg:p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium text-stone-900">{label}</h2>
        <span className="text-xs font-mono text-stone-400">
          {items.length} / {maxPhotos}
        </span>
      </div>
      <p className="text-xs text-stone-400 mb-4">{description}</p>

      {/* Grid of photos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-3">
        {items.map((item, index) => {
          const isCover = index === 0
          const isUploading = item.status === 'uploading' || item.status === 'pending'
          const isError = item.status === 'error'

          return (
            <div
              key={item.id}
              data-testid="photo-card"
              className={`relative aspect-square rounded-xl overflow-hidden border bg-stone-50 group transition-all ${
                isCover ? 'ring-2 ring-stone-800 border-transparent shadow-sm' : 'border-stone-200'
              } ${isError ? 'border-red-400 bg-red-50' : ''}`}
            >
              {/* Image Preview */}
              {item.url ? (
                <img
                  src={item.url}
                  alt={`Product photo ${index + 1}`}
                  className={`w-full h-full object-cover transition-opacity ${
                    isUploading ? 'opacity-60 blur-[0.5px]' : 'opacity-100'
                  }`}
                  onError={() => {
                    // Fallback visual if broken image URL
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300">
                  <Upload className="w-6 h-6" />
                </div>
              )}

              {/* Cover Badge */}
              {isCover && (
                <div className="absolute top-2 left-2 bg-stone-900/90 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded shadow-sm z-10 flex items-center gap-1">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  <span>Cover</span>
                </div>
              )}

              {/* Uploading Overlay */}
              {isUploading && (
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white p-2 text-center z-10">
                  <Loader2 className="w-5 h-5 animate-spin mb-1 text-amber-400" />
                  <span className="text-[10px] font-mono tracking-tight font-medium">
                    {item.status === 'uploading' ? 'Uploading…' : 'Queued…'}
                  </span>
                </div>
              )}

              {/* Error Overlay */}
              {isError && (
                <div className="absolute inset-0 bg-red-950/80 text-white flex flex-col items-center justify-center p-2 text-center z-10">
                  <AlertCircle className="w-5 h-5 text-red-400 mb-1 shrink-0" />
                  <p className="text-[10px] text-red-200 leading-tight mb-2 line-clamp-2" title={item.error}>
                    {item.error || 'Upload failed'}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {item.file && (
                      <button
                        type="button"
                        onClick={() => handleRetry(item.id)}
                        className="bg-white/20 hover:bg-white/30 text-white text-[10px] px-2 py-0.5 rounded flex items-center gap-1 font-medium transition-colors"
                      >
                        <RefreshCw className="w-2.5 h-2.5" /> Retry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      className="bg-red-500 hover:bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded transition-colors"
                      aria-label="Remove failed upload"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Action Controls Overlay (Hover state on desktop, touch friendly) */}
              {!isUploading && !isError && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5 z-10 pointer-events-auto">
                  {/* Top row: Remove button */}
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemove(item.id)
                      }}
                      className="w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
                      title="Remove photo"
                      aria-label="Remove photo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Bottom row: Reorder controls */}
                  <div className="flex items-center justify-between gap-1 bg-black/60 backdrop-blur-sm p-1 rounded-lg">
                    {/* Move Left */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveLeft(index)
                      }}
                      disabled={index === 0}
                      className="p-1 text-white hover:text-amber-300 disabled:opacity-20 disabled:hover:text-white transition-colors"
                      title="Move earlier in order"
                      aria-label="Move left"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* Make Cover */}
                    {!isCover && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMakeCover(index)
                        }}
                        className="text-[10px] text-amber-300 hover:text-white font-medium px-1 uppercase tracking-wider flex items-center gap-0.5"
                        title="Set as cover image"
                      >
                        <Star className="w-3 h-3" />
                        <span>Cover</span>
                      </button>
                    )}

                    {/* Move Right */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMoveRight(index)
                      }}
                      disabled={index === items.length - 1}
                      className="p-1 text-white hover:text-amber-300 disabled:opacity-20 disabled:hover:text-white transition-colors"
                      title="Move later in order"
                      aria-label="Move right"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Upload Trigger Tile */}
        {!atLimit && (
          <label
            className={`aspect-square border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${
              disabled || isAnyUploading
                ? 'border-stone-200 bg-stone-50 text-stone-400'
                : 'border-stone-300 hover:border-stone-800 hover:bg-yellow-50/50 text-stone-500 hover:text-stone-900'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleInputChange}
              disabled={disabled}
            />
            <Upload className={`w-5 h-5 mb-1.5 ${isAnyUploading ? 'animate-pulse text-stone-400' : 'text-stone-400'}`} />
            <span className="text-xs font-medium">
              {isAnyUploading ? 'Uploading…' : 'Add photos'}
            </span>
            <span className="text-[10px] text-stone-400 mt-0.5">PNG, JPG up to 25MB</span>
          </label>
        )}
      </div>

      {items.length === 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          No photos — products without photos show a placeholder on the jeweler portal.
        </p>
      )}
    </div>
  )
}
export default ProductPhotoUploader
