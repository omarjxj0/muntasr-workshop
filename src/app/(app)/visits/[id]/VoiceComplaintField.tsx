'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

interface Props {
  value: string
  onChange: (val: string) => void
  rows?: number
  disabled?: boolean
}

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export default function VoiceComplaintField({ value, onChange, rows = 3, disabled = false }: Props) {
  const [isListening, setIsListening] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<{ id: string; text: string }[]>([])
  const recognitionRef = useRef<any>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchComplaints = async () => {
      const { data } = await supabase.from('common_complaints').select('id, text').order('created_at', { ascending: true })
      if (data) setSuggestions(data)
    }
    fetchComplaints()
  }, [supabase])

  const startListening = useCallback(() => {
    if (disabled) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      toast.error('متصفحك لا يدعم التعرف على الصوت. استخدم Chrome.')
      return
    }

    const recognition = new SR()
    recognition.lang = 'ar-IQ'
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = (e: any) => {
      setIsListening(false)
      if (e.error !== 'no-speech') toast.error('فشل في التعرف على الصوت')
    }
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      onChange(value ? value + ' ' + transcript : transcript)
      toast.success('تم إضافة النص الصوتي', { icon: '🎙️' })
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [value, onChange, disabled])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const applySuggestion = (suggestion: string) => {
    if (disabled) return
    onChange(value ? value + ' — ' + suggestion : suggestion)
    setShowSuggestions(false)
  }

  return (
    <div className="space-y-2">
      {/* Suggestion datalist dropdown */}
      {!disabled && (
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setShowSuggestions(v => !v)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all border border-violet-100 bg-violet-50/80 text-violet-700 hover:bg-violet-100 font-semibold"
          >
            <ChevronDown size={13} className={showSuggestions ? 'rotate-180 transition-transform' : 'transition-transform'} />
            مشاكل شائعة
          </button>

          {showSuggestions && (
            <div className="absolute top-full right-0 mt-1 z-20 rounded-2xl overflow-hidden shadow-xl border w-72 bg-white border-slate-100 divide-y divide-slate-50">
              <div className="max-h-48 overflow-y-auto">
                {suggestions.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => applySuggestion(s.text)}
                    className="w-full text-right px-4 py-2.5 text-sm transition-colors hover:bg-violet-50 text-slate-700"
                  >
                    {s.text}
                  </button>
                ))}
                {suggestions.length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-400 text-center">لا توجد شكاوى شائعة مضافة</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Textarea + mic button */}
      <div className="relative">
        <textarea
          value={value}
          onChange={e => !disabled && onChange(e.target.value)}
          disabled={disabled}
          rows={rows}
          placeholder={disabled ? 'لا يوجد وصف مدخل' : 'اكتب وصف المشكلة، اختر من المشاكل الشائعة، أو سجّل بالصوت...'}
          className={`w-full px-4 py-3 rounded-2xl text-sm transition-all border-2 border-slate-200 text-slate-800 placeholder-slate-400 resize-none ${
            disabled
              ? 'bg-slate-100/60 cursor-not-allowed text-slate-600'
              : 'bg-white focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.1)] pl-12'
          }`}
        />

        {/* Mic button */}
        {!disabled && (
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            className={`absolute left-3 top-3 p-2 rounded-xl transition-all border ${
              isListening
                ? 'bg-rose-100 text-rose-600 border-rose-200'
                : 'bg-violet-50 text-violet-600 border-violet-100 hover:bg-violet-100'
            }`}
            title={isListening ? 'إيقاف الاستماع' : 'بدء التسجيل الصوتي'}
          >
            {isListening ? (
              <MicOff size={16} className="animate-pulse" />
            ) : (
              <Mic size={16} />
            )}
          </button>
        )}
      </div>

      {isListening && (
        <p className="text-xs flex items-center gap-2 animate-pulse text-rose-500 font-medium">
          <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
          جارٍ الاستماع... انقر زر الميكروفون للإيقاف
        </p>
      )}
    </div>
  )
}
