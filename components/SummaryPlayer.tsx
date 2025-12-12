import React, { useEffect, useRef, useState } from 'react';

interface SummaryPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  audioBuffer: ArrayBuffer | null;
}

export const SummaryPlayer: React.FC<SummaryPlayerProps> = ({ isOpen, onClose, images, audioBuffer }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen && audioBuffer) {
        initAudio();
    } else {
        stopPlayback();
    }
    return () => stopPlayback();
  }, [isOpen, audioBuffer]);

  const initAudio = async () => {
    try {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        }
        
        // Ensure context is running (browser policy)
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        // Decode specific to Gemini 2.5 Flash Audio (24kHz PCM) - Helper from guidelines logic
        // We actually need to manually decode raw PCM if standard decodeAudioData fails, 
        // but typically standard decode works for many formats, or we use the custom decoder.
        // Given guidelines, we'll try the custom decoder approach for raw PCM.
        
        const decodedBuffer = await decodeAudioData(new Uint8Array(audioBuffer!), audioContextRef.current, 24000, 1);
        durationRef.current = decodedBuffer.duration;
        
        startPlayback(decodedBuffer);
    } catch (e) {
        console.error("Audio init error", e);
    }
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  const startPlayback = (buffer: AudioBuffer) => {
      if (!audioContextRef.current) return;
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
          setIsPlaying(false);
          // Don't auto-close, let user see the end
      };
      
      sourceNodeRef.current = source;
      source.start(0);
      startTimeRef.current = audioContextRef.current.currentTime;
      setIsPlaying(true);
      
      // Start Animation Loop
      const animate = () => {
          if (!audioContextRef.current) return;
          const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
          
          if (elapsed < durationRef.current) {
             const progress = elapsed / durationRef.current;
             // Calculate which image to show based on progress
             // 0% -> 0, 100% -> last image
             const index = Math.min(
                 Math.floor(progress * images.length), 
                 images.length - 1
             );
             setCurrentImageIndex(index);
             rafRef.current = requestAnimationFrame(animate);
          } else {
             setCurrentImageIndex(images.length - 1);
          }
      };
      
      rafRef.current = requestAnimationFrame(animate);
  };

  const stopPlayback = () => {
      if (sourceNodeRef.current) {
          try { sourceNodeRef.current.stop(); } catch(e) {}
          sourceNodeRef.current = null;
      }
      if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
      }
      setIsPlaying(false);
      setCurrentImageIndex(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
       <div className="relative w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800">
           {images.length > 0 && (
               <img 
                 src={images[currentImageIndex]} 
                 alt={`Step view`} 
                 className="w-full h-full object-contain animate-fade-in"
               />
           )}
           
           <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
               <h3 className="text-white text-xl font-bold mb-2">Transformation Summary</h3>
               <div className="flex items-center gap-4">
                   <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-indigo-500 transition-all duration-100 ease-linear"
                         style={{ width: `${((currentImageIndex + 1) / images.length) * 100}%` }}
                       ></div>
                   </div>
                   <span className="text-white/60 text-sm font-mono">
                       Step {currentImageIndex + 1}/{images.length}
                   </span>
               </div>
           </div>

           <button 
             onClick={onClose}
             className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
           </button>
       </div>
       <div className="mt-4 text-white/50 text-sm flex items-center gap-2">
           {isPlaying ? (
               <>
                 <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                 Playing Summary Voiceover
               </>
           ) : (
               "Playback Finished"
           )}
       </div>
    </div>
  );
};
