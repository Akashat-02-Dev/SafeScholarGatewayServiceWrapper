import { useState, useRef } from 'react'

import { Mic, MicOff, Volume2, VolumeX, Sparkles } from 'lucide-react'

interface AudioSocraticRecorderProps {
  onTranscript: (text: string) => void
  aiResponseText?: string
}

export function AudioSocraticRecorder({ onTranscript, aiResponseText }: AudioSocraticRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)

  const getTokens = () => {
    const raw = sessionStorage.getItem('safescholar.token.v1')
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  const startRecording = async () => {
    audioChunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        await sendAudioBlobForTranscription(audioBlob)
        
        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Failed to access microphone. Running mock transcription fallback.', err)
      // Fallback: Simulate microphone recording and call mock endpoint
      setIsRecording(true)
      setTimeout(() => {
        stopRecording()
      }, 3000)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
    } else {
      // Simulate mock fallback submission
      simulateMockTranscription()
    }
    setIsRecording(false)
  }

  const simulateMockTranscription = async () => {
    setIsTranscribing(true)
    
    // Create a tiny mock audio blob to satisfy FormData upload
    const dummyBlob = new Blob([new Uint8Array(1000)], { type: 'audio/wav' })
    await sendAudioBlobForTranscription(dummyBlob)
  }

  const sendAudioBlobForTranscription = async (blob: Blob) => {
    setIsTranscribing(true)
    const tokens = getTokens()
    const token = tokens?.accessToken


    try {
      const formData = new FormData()
      formData.append('file', blob, 'recording.wav')

      // Use native fetch to handle multipart/form-data with access token header
      const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || ''
      const res = await fetch(`${apiBase}/api/v1/audio/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'Accept': 'application/json'
        },
        body: formData
      })

      if (!res.ok) {
        throw new Error('Failed to transcribe audio')
      }

      const data = await res.json()
      if (data && data.text) {
        onTranscript(data.text)
      }
    } catch (err) {
      console.error('Transcription failed', err)
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleSynthesizeAndPlay = async () => {
    if (!aiResponseText || isPlaying) return

    setIsPlaying(true)
    const token = getTokens()
    // const token = token ? token.accessToken : null

    try {
      const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || ''
      const res = await fetch(`${apiBase}/api/v1/audio/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({ text: aiResponseText, voice: 'alloy' })
      })

      if (!res.ok) {
        throw new Error('Failed to synthesize speech')
      }

      const blob = await res.blob()
      const audioUrl = URL.createObjectURL(blob)
      
      const audio = new Audio(audioUrl)
      audioPlayerRef.current = audio
      
      audio.onended = () => {
        setIsPlaying(false)
        URL.revokeObjectURL(audioUrl)
      }

      audio.play()
    } catch (err) {
      console.error('Speech synthesis failed', err)
      setIsPlaying(false)
    }
  }

  const stopPlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      setIsPlaying(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {/* Microphone Record Button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isTranscribing}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: '1px solid var(--border)',
          background: isRecording ? '#ef4444' : 'rgba(255, 255, 255, 0.85)',
          color: isRecording ? '#ffffff' : 'var(--c-navy)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isTranscribing ? 'not-allowed' : 'pointer',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.2s',
          position: 'relative'
        }}
        title={isRecording ? 'Stop Recording' : 'Record Audio'}
      >
        {isRecording ? <MicOff size={16} /> : <Mic size={16} />}

        {/* Live Visual Waveform Micro-animation */}
        {isRecording && (
          <div style={{
            position: 'absolute',
            bottom: '-12px',
            display: 'flex',
            gap: '2px',
            height: '10px',
            alignItems: 'center'
          }}>
            <span className="wave-bar" style={{ width: '2px', height: '4px', background: '#ef4444', animation: 'bounce 0.5s infinite alternate' }} />
            <span className="wave-bar" style={{ width: '2px', height: '8px', background: '#ef4444', animation: 'bounce 0.5s infinite alternate 0.1s' }} />
            <span className="wave-bar" style={{ width: '2px', height: '6px', background: '#ef4444', animation: 'bounce 0.5s infinite alternate 0.2s' }} />
            <span className="wave-bar" style={{ width: '2px', height: '9px', background: '#ef4444', animation: 'bounce 0.5s infinite alternate 0.05s' }} />
          </div>
        )}
      </button>

      {/* TTS Playback Voice Button */}
      {aiResponseText && (
        <button
          onClick={isPlaying ? stopPlayback : handleSynthesizeAndPlay}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '1px solid var(--border)',
            background: isPlaying ? 'var(--c-navy)' : 'rgba(255, 255, 255, 0.85)',
            color: isPlaying ? '#ffffff' : 'var(--c-slate)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.2s'
          }}
          title={isPlaying ? 'Stop Speech' : 'Speak Response'}
        >
          {isPlaying ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      )}

      {isTranscribing && (
        <span style={{ fontSize: '11px', color: 'var(--c-slate)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Sparkles className="spin" size={12} style={{ animation: 'spin 1.5s linear infinite' }} />
          Transcribing...
        </span>
      )}

      {/* Waveform Keyframe styles injected inline */}
      <style>{`
        @keyframes bounce {
          0% { height: 3px; }
          100% { height: 10px; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
