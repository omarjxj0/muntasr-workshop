'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Trash2, ZoomIn, X, Upload, ImageOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface VisitImage {
  id: string
  image_url: string
  file_name: string | null
  uploaded_at: string
}

interface Props {
  visitId: string
  initialImages?: VisitImage[]
  isLocked?: boolean
}

const BUCKET = 'visit-images'

export default function VisitImages({ visitId, initialImages = [], isLocked = false }: Props) {
  const [images, setImages] = useState<VisitImage[]>(initialImages)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Fetch existing images on mount or when visitId changes
  useEffect(() => {
    let isMounted = true
    async function fetchImages() {
      if (!visitId) return
      setLoading(true)
      const { data, error } = await supabase
        .from('visit_images')
        .select('*')
        .eq('visit_id', visitId)
        .order('uploaded_at', { ascending: true })

      if (error) {
        console.warn('Error fetching visit images:', error)
      } else if (data && isMounted) {
        setImages(data as VisitImage[])
      }
      if (isMounted) setLoading(false)
    }

    fetchImages()
    return () => { isMounted = false }
  }, [visitId, supabase])

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (isLocked || !files?.length) return
    setUploading(true)

    for (const file of Array.from(files)) {
      // Validate type
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name}: يجب أن يكون ملف صورة`)
        continue
      }
      // Max 8MB
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name}: الحجم الأقصى 8MB`)
        continue
      }

      const ext = file.name.split('.').pop()
      const path = `${visitId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false })

      if (uploadError) {
        console.error('Storage Upload Error:', uploadError)
        toast.error(`فشل رفع ${file.name}: ${uploadError.message}`)
        continue
      }

      // Permanent Public URL
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
      const publicUrl = urlData.publicUrl

      // Insert record into visit_images table
      const { data: row, error: insertError } = await supabase
        .from('visit_images')
        .insert({ 
          visit_id: visitId, 
          image_url: publicUrl, 
          file_name: file.name 
        } as any)
        .select()
        .single()

      if (insertError) {
        console.error('Database Insert Error for visit_images:', insertError)
        toast.error(`فشل في حفظ الصورة في قاعدة البيانات: ${insertError.message}`)
        continue
      }

      setImages(prev => [...prev, row as VisitImage])
      toast.success(`تم رفع ${file.name}`, { icon: '🖼️' })
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [visitId, supabase, isLocked])

  const handleDelete = async (image: VisitImage) => {
    if (isLocked) return
    if (!confirm('هل أنت متأكد من حذف هذه الصورة؟')) return

    try {
      const url = new URL(image.image_url)
      const pathStart = url.pathname.indexOf(`/${BUCKET}/`) + `/${BUCKET}/`.length
      const storagePath = url.pathname.slice(pathStart)

      await supabase.storage.from(BUCKET).remove([storagePath])
    } catch (e) {
      console.warn('Could not remove file from storage:', e)
    }

    const { error } = await supabase.from('visit_images').delete().eq('id', image.id)
    if (error) { toast.error('فشل في حذف الصورة'); return }

    setImages(prev => prev.filter(i => i.id !== image.id))
    toast.success('تم حذف الصورة')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!isLocked) {
      handleUpload(e.dataTransfer.files)
    }
  }

  return (
    <>
      <div className="soft-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2 text-slate-700">
            <Camera size={18} className="text-violet-500" />
            صور الزيارة
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {images?.length || 0}
            </span>
          </h2>
          {!isLocked && (
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-60 border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 shadow-sm"
              >
                <Upload size={15} />
                {uploading ? 'جارٍ الرفع...' : 'رفع صورة'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handleUpload(e.target.files)}
              />
            </div>
          )}
        </div>

        {/* Drop zone / Image grid */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => !isLocked && (!images || images.length === 0) && fileInputRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed transition-all border-slate-200 bg-slate-50/50 ${
            !images || images.length === 0
              ? isLocked
                ? 'py-8'
                : 'cursor-pointer hover:bg-slate-100/60 min-h-[90px]'
              : 'p-3'
          }`}
        >
          {!images || images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-400">
              <ImageOff size={28} />
              <p className="text-sm">
                {isLocked ? 'لا توجد صور مرفقة في هذه الزيارة' : 'اسحب وأفلت صور هنا أو انقر للاختيار'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {images.map(img => (
                <div
                  key={img.id}
                  className="relative group rounded-xl overflow-hidden aspect-square border border-slate-200 shadow-sm bg-white"
                >
                  <img
                    src={img.image_url}
                    alt={img.file_name ?? 'صورة'}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/60 backdrop-blur-xs">
                    <button
                      type="button"
                      onClick={() => setLightbox(img.image_url)}
                      className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 transition-colors"
                      title="تكبير الصورة"
                    >
                      <ZoomIn size={16} />
                    </button>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => handleDelete(img)}
                        className="p-2 rounded-xl bg-rose-500/80 text-white hover:bg-rose-600 transition-colors"
                        title="حذف الصورة"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 left-4 p-2.5 rounded-2xl bg-white/10 text-white hover:bg-white/20 transition-all"
            onClick={() => setLightbox(null)}
          >
            <X size={22} />
          </button>
          <img
            src={lightbox}
            alt="عرض الصورة"
            className="max-w-full max-h-full rounded-2xl shadow-2xl"
            style={{ objectFit: 'contain' }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
