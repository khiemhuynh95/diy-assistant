import React, { useState, useEffect } from 'react';
import { fileToGenerativePart, generateDIYPlan, generateProductImage, generateRoomTourVideo, generateStepImage, generateProjectSummaryAudio, generateNightTourVideo } from './services/geminiService';
import { AppState, DIYPlan, ImageInput, Material, Step } from './types';
import { FileUpload } from './components/FileUpload';
import { StepVisualizer } from './components/StepVisualizer';
import { SummaryPlayer } from './components/SummaryPlayer';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.INPUT);
  const [inspirationImage, setInspirationImage] = useState<ImageInput | null>(null);
  const [currentImage, setCurrentImage] = useState<ImageInput | null>(null);
  const [dimensions, setDimensions] = useState<string>("");
  const [styleAdjustments, setStyleAdjustments] = useState<string>("");
  const [plan, setPlan] = useState<DIYPlan | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  
  // Store generated visuals indexed by step index. 
  // key = step index, value = base64/data url string
  const [stepVisuals, setStepVisuals] = useState<Record<number, string>>({});
  
  // Track which step is currently being auto-generated
  const [generatingStepIndex, setGeneratingStepIndex] = useState<number | null>(null);

  // Store completed substeps
  const [completedSubsteps, setCompletedSubsteps] = useState<Record<string, boolean>>({});

  // Subtask Editing State
  const [editingSubstep, setEditingSubstep] = useState<{sIdx: number, subIdx: number} | null>(null);
  const [editValue, setEditValue] = useState("");

  // Material Modal State
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [materialImages, setMaterialImages] = useState<Record<string, string>>({}); // Cache
  const [generatingMaterialImage, setGeneratingMaterialImage] = useState(false);

  // Summary Audio State
  const [summaryAudioBuffer, setSummaryAudioBuffer] = useState<ArrayBuffer | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [showSummaryPlayer, setShowSummaryPlayer] = useState(false);

  // Night Tour Video State
  const [nightVideoUrl, setNightVideoUrl] = useState<string | null>(null);
  const [isNightVideoLoading, setIsNightVideoLoading] = useState(false);

  // PDF Loading State
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  // Prefill Images on Mount
  useEffect(() => {
    const preloadImages = async () => {
      const loadImg = async (path: string): Promise<ImageInput | null> => {
        try {
          const res = await fetch(path);
          if (!res.ok) return null;
          const blob = await res.blob();
          const file = new File([blob], path, { type: blob.type });
          const base64 = await fileToGenerativePart(file);
          return {
            file,
            previewUrl: URL.createObjectURL(file),
            base64
          };
        } catch (e) {
          console.warn(`Failed to preload ${path}`, e);
          return null;
        }
      };

      if (!currentImage) {
        const origin = await loadImg('origin.jpeg');
        if (origin) setCurrentImage(origin);
      }

      if (!inspirationImage) {
        const inspired = await loadImg('inspired.jpeg');
        if (inspired) setInspirationImage(inspired);
      }
    };

    preloadImages();
  }, []);

  const isFinalStepVisualized = () => {
    if (!plan) return false;
    const lastStepIndex = plan.steps[plan.steps.length - 1].stepNumber;
    return !!stepVisuals[lastStepIndex];
  };

  // Auto-generation Orchestrator
  useEffect(() => {
    if (appState !== AppState.RESULT || !plan) return;
    
    // Prevent overlapping operations
    if (generatingStepIndex !== null) return;
    
    // Find the next step that needs visualization
    const nextStep = plan.steps.find(step => !stepVisuals[step.stepNumber]);

    if (nextStep) {
      generateVisualForStep(nextStep);
    }
  }, [appState, plan, stepVisuals, generatingStepIndex]);

  const generateVisualForStep = async (step: Step) => {
    setGeneratingStepIndex(step.stepNumber);
    try {
      // Determine context image: Use previous step's output, or current state for the first step
      let contextBase64 = currentImage?.base64;
      if (step.stepNumber > 1) {
        const prevStepImage = stepVisuals[step.stepNumber - 1];
        if (prevStepImage) {
          contextBase64 = prevStepImage;
        }
      }

      // Collect previous step instructions to inform the model about the current state
      const previousSteps = plan?.steps.filter(s => s.stepNumber < step.stepNumber) || [];
      const previousContext = previousSteps.length > 0 
        ? previousSteps.map(s => s.instruction).join(". ") 
        : "";

      // Generate
      const url = await generateStepImage(step.visualizationPrompt, contextBase64, {}, previousContext);
      handleStepVisualGenerated(step.stepNumber, url);
    } catch (e) {
      console.error(`Auto-generation failed for step ${step.stepNumber}`, e);
    } finally {
      setGeneratingStepIndex(null);
    }
  };

  const handleGenerateSummary = async () => {
      if (!plan) return;
      setIsSummaryLoading(true);
      try {
          const buffer = await generateProjectSummaryAudio(plan);
          setSummaryAudioBuffer(buffer);
          setShowSummaryPlayer(true);
      } catch (e) {
          console.error("Summary gen failed", e);
          alert("Failed to generate audio summary.");
      } finally {
          setIsSummaryLoading(false);
      }
  };

  const handleGenerateNightTour = async () => {
    if (!plan || isNightVideoLoading || nightVideoUrl) return;

    const lastStepIdx = plan.steps[plan.steps.length - 1].stepNumber;
    const bestImage = stepVisuals[lastStepIdx];
    if (!bestImage) return;

    setIsNightVideoLoading(true);
    try {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
      }
    } catch (e) {
      console.warn("API Key selection flow issue:", e);
    }

    try {
      const url = await generateNightTourVideo(bestImage);
      setNightVideoUrl(url);
    } catch (e) {
      console.error(e);
      alert("Video generation failed");
    } finally {
      setIsNightVideoLoading(false);
    }
  };

  const handleFileSelect = async (file: File, type: 'inspiration' | 'current') => {
    try {
      const base64 = await fileToGenerativePart(file);
      const input: ImageInput = {
        file,
        previewUrl: URL.createObjectURL(file),
        base64
      };
      if (type === 'inspiration') setInspirationImage(input);
      else setCurrentImage(input);
    } catch (e) {
      console.error(e);
      alert("Error reading file");
    }
  };

  const handleSubmit = async () => {
    if (!inspirationImage || !currentImage) {
      alert("Please upload both images.");
      return;
    }

    setAppState(AppState.ANALYZING);
    setErrorMsg("");
    setStepVisuals({}); 
    setCompletedSubsteps({}); 
    setMaterialImages({}); 
    setSummaryAudioBuffer(null);
    setNightVideoUrl(null);
    setGeneratingStepIndex(null);

    try {
      const generatedPlan = await generateDIYPlan(
        inspirationImage.base64,
        currentImage.base64,
        dimensions,
        styleAdjustments
      );
      setPlan(generatedPlan);
      setAppState(AppState.RESULT);
    } catch (e) {
      console.error(e);
      setErrorMsg("Failed to generate plan. Please try again or use clearer images.");
      setAppState(AppState.ERROR);
    }
  };

  const handleStepVisualGenerated = (index: number, imageUrl: string) => {
    setStepVisuals(prev => {
      const newState = { ...prev, [index]: imageUrl };
      Object.keys(prev).forEach(key => {
        const keyNum = parseInt(key);
        if (keyNum > index) {
          delete newState[keyNum];
        }
      });
      return newState;
    });
    // Invalidate outputs that depend on final state
    setNightVideoUrl(null);
    setSummaryAudioBuffer(null);
  };

  const toggleSubstep = (stepIndex: number, subIdx: number) => {
    const key = `${stepIndex}-${subIdx}`;
    setCompletedSubsteps(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // --- Subtask Management ---

  const startEditingSubstep = (sIdx: number, subIdx: number, text: string) => {
    setEditingSubstep({ sIdx, subIdx });
    setEditValue(text);
  };

  const saveSubstep = () => {
    if (!plan || !editingSubstep) return;
    const { sIdx, subIdx } = editingSubstep;
    
    const newPlan = { ...plan };
    newPlan.steps[sIdx].substeps[subIdx] = editValue;
    setPlan(newPlan);
    setEditingSubstep(null);
  };

  const deleteSubstep = (sIdx: number, subIdx: number) => {
    if (!plan) return;
    const newPlan = { ...plan };
    newPlan.steps[sIdx].substeps.splice(subIdx, 1);
    setPlan(newPlan);
  };

  const moveSubstep = (sIdx: number, subIdx: number, direction: -1 | 1) => {
    if (!plan) return;
    const substeps = plan.steps[sIdx].substeps;
    const newIndex = subIdx + direction;
    
    if (newIndex < 0 || newIndex >= substeps.length) return;
    
    const newPlan = { ...plan };
    const temp = newPlan.steps[sIdx].substeps[subIdx];
    newPlan.steps[sIdx].substeps[subIdx] = newPlan.steps[sIdx].substeps[newIndex];
    newPlan.steps[sIdx].substeps[newIndex] = temp;
    setPlan(newPlan);
    
    // Swap completion state
    const currentKey = `${sIdx}-${subIdx}`;
    const newKey = `${sIdx}-${newIndex}`;
    setCompletedSubsteps(prev => {
      const next = { ...prev };
      const val1 = next[currentKey];
      const val2 = next[newKey];
      next[currentKey] = val2;
      next[newKey] = val1;
      return next;
    });
  };

  const addSubstep = (sIdx: number) => {
    if (!plan) return;
    const newPlan = { ...plan };
    newPlan.steps[sIdx].substeps.push("New step");
    setPlan(newPlan);
    
    const newSubIdx = newPlan.steps[sIdx].substeps.length - 1;
    setEditingSubstep({ sIdx, subIdx: newSubIdx });
    setEditValue("New step");
  };

  // -------------------------

  const handleMaterialClick = async (item: Material) => {
    setSelectedMaterial(item);
    if (materialImages[item.name]) return; 

    setGeneratingMaterialImage(true);
    try {
      const isTool = item.category === 'tool';
      const style = isTool 
        ? "Professional Hardware Equipment" 
        : (plan?.styleAnalysis || "Modern Home Decor");

      const url = await generateProductImage(item.name, style);
      setMaterialImages(prev => ({ ...prev, [item.name]: url }));
    } catch (e) {
      console.error("Failed to generate product image", e);
    } finally {
      setGeneratingMaterialImage(false);
    }
  };

  const handleDownloadPDF = () => {
    setIsPdfGenerating(true);
    const element = document.getElementById('diy-plan-content');
    if (!element) return;
    
    const html2pdf = (window as any).html2pdf;
    if (!html2pdf) {
        alert("PDF generator not loaded yet.");
        setIsPdfGenerating(false);
        return;
    }

    const opt = {
      margin: [0.5, 0.5],
      filename: `${plan?.projectTitle || 'DIY-Plan'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        setIsPdfGenerating(false);
    });
  };

  const closeMaterialModal = () => {
    setSelectedMaterial(null);
  };

  const reset = () => {
    setAppState(AppState.INPUT);
    setPlan(null);
    setInspirationImage(null);
    setCurrentImage(null);
    setDimensions("");
    setStyleAdjustments("");
    setStepVisuals({});
    setCompletedSubsteps({});
    setMaterialImages({});
    setSummaryAudioBuffer(null);
    setNightVideoUrl(null);
    setSelectedMaterial(null);
    setGeneratingStepIndex(null);
    setIsNightVideoLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const getCategoryColor = (category: string) => {
    switch(category) {
      case 'tool': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'consumable': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'furniture': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'decor': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-gray-100';
    }
  };

  if (appState === AppState.INPUT) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-indigo-600 p-8 text-white text-center">
            <h1 className="text-3xl font-bold mb-2 tracking-tight">DIY Visionary Assistant</h1>
            <p className="text-indigo-100 max-w-2xl mx-auto">
              Upload your current room and an inspiration photo. Our AI will generate a step-by-step DIY manual with realistic progress visualizations.
            </p>
          </div>
          
          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <FileUpload 
                label="1. Current State" 
                description="Photo of your room as it is now."
                imageInput={currentImage}
                onFileSelect={(f) => handleFileSelect(f, 'current')}
                onClear={() => setCurrentImage(null)}
              />
              <FileUpload 
                label="2. Inspiration" 
                description="Photo of the style you want to achieve."
                imageInput={inspirationImage}
                onFileSelect={(f) => handleFileSelect(f, 'inspiration')}
                onClear={() => setInspirationImage(null)}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
               <div className="w-full">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Room Dimensions (Optional)
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. 12x14 feet, 3m high ceiling"
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
               <div className="w-full">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Custom Style Adjustments (Optional)
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Make it more minimalist, use blue instead of green"
                    value={styleAdjustments}
                    onChange={(e) => setStyleAdjustments(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
               </div>
            </div>

            <button 
              onClick={handleSubmit}
              disabled={!inspirationImage || !currentImage}
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all transform hover:scale-[1.01] ${
                inspirationImage && currentImage 
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Generate My DIY Plan
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (appState === AppState.ANALYZING) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-lg">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-indigo-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 m-auto h-10 w-10 text-indigo-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Analyzing Your Space</h2>
          <p className="text-slate-600 mb-8">
            Gemini is identifying materials, calculating dimensions, and architecting your step-by-step transformation plan...
          </p>
          <div className="flex justify-center gap-2">
            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></span>
            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce delay-100"></span>
            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce delay-200"></span>
          </div>
        </div>
      </div>
    );
  }

  if (appState === AppState.ERROR) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Generation Failed</h2>
          <p className="text-slate-600 mb-6">{errorMsg}</p>
          <button 
            onClick={reset}
            className="px-6 py-3 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">D</div>
            <h1 className="font-bold text-xl text-slate-800">DIY Visionary</h1>
          </div>
          <div className="flex gap-3">
             <button 
              onClick={handleDownloadPDF}
              disabled={isPdfGenerating}
              className="px-4 py-2 text-slate-600 hover:text-indigo-600 font-medium text-sm flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors"
            >
              {isPdfGenerating ? (
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              {isPdfGenerating ? 'Generating PDF...' : 'Download PDF'}
            </button>
             <button 
              onClick={handlePrint}
              className="px-4 py-2 text-slate-600 hover:text-indigo-600 font-medium text-sm flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Manual
            </button>
            <button 
              onClick={reset}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm transition-colors"
            >
              New Project
            </button>
          </div>
        </div>
      </header>

      <main id="diy-plan-content" className="max-w-5xl mx-auto px-4 py-8">
        
        {/* Project Header */}
        <section className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 mb-8 break-inside-avoid">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            <div className="flex-1">
              <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wide mb-3">
                {plan?.difficultyLevel} Level
              </span>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">{plan?.projectTitle}</h1>
              <p className="text-slate-600 leading-relaxed mb-4">{plan?.description}</p>
              
              <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                <div className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {plan?.estimatedTime}
                </div>
                <div className="flex items-center gap-1">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343-2-3-2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {plan?.estimatedTotalCost}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="w-full md:w-64 h-40 rounded-xl overflow-hidden shadow-md relative group">
                <img src={currentImage?.previewUrl} alt="Before" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 bg-black/50 text-white text-xs px-2 py-1">Before</div>
              </div>
            </div>
          </div>
        </section>

        {/* Materials List */}
        <section className="mb-12 break-inside-avoid">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </span>
            Required Materials & Tools
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plan?.materials.map((item, idx) => (
              <div 
                key={idx} 
                onClick={() => handleMaterialClick(item)}
                className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${getCategoryColor(item.category)}`}
              >
                <div className="flex justify-between items-start mb-2">
                   <h3 className="font-semibold">{item.name}</h3>
                   <span className="text-xs font-mono opacity-70 bg-white/50 px-2 py-1 rounded">{item.estimatedCost}</span>
                </div>
                <div className="flex justify-between items-center text-sm opacity-80">
                  <span>{item.quantity}</span>
                  <span className="uppercase text-[10px] tracking-wider font-bold">{item.category}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="space-y-12 mb-16">
          {plan?.steps.map((step, idx) => (
            <div key={idx} className="relative pl-8 md:pl-0 break-inside-avoid">
              <div className="hidden md:flex flex-col items-center absolute left-0 top-0 h-full -ml-4">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center z-10 shadow-lg border-4 border-slate-50">
                  {step.stepNumber}
                </div>
                <div className={`w-0.5 flex-1 ${idx === plan.steps.length - 1 ? 'bg-transparent' : 'bg-slate-200'}`}></div>
              </div>
              
              <div className="md:ml-12 bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="md:hidden absolute top-6 left-6 w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center z-10 shadow-lg">
                  {step.stepNumber}
                </div>
                
                <div className="md:pl-0 pl-10 mb-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-slate-900">{step.title}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      step.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                      step.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {step.difficulty}
                    </span>
                  </div>
                  <p className="text-slate-600 mb-4 font-medium">{step.instruction}</p>
                  
                  {step.safetyWarning && (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4 flex gap-3 text-red-700 text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {step.safetyWarning}
                    </div>
                  )}

                  <div className="space-y-2 mb-6">
                    {step.substeps.map((sub, sIdx) => {
                      const isEditing = editingSubstep?.sIdx === idx && editingSubstep?.subIdx === sIdx;
                      
                      return (
                        <div key={sIdx} className="group relative flex items-start gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                          {isEditing ? (
                            <div className="flex-1 flex gap-2">
                              <input 
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="flex-1 p-1 border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveSubstep();
                                  if (e.key === 'Escape') setEditingSubstep(null);
                                }}
                              />
                              <button onClick={saveSubstep} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </button>
                              <button onClick={() => setEditingSubstep(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <>
                              <input 
                                type="checkbox" 
                                checked={!!completedSubsteps[`${idx}-${sIdx}`]}
                                onChange={() => toggleSubstep(idx, sIdx)}
                                className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer" 
                              />
                              <span className={`text-sm flex-1 ${completedSubsteps[`${idx}-${sIdx}`] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                {sub}
                              </span>
                              
                              {/* Subtask Controls */}
                              <div className="hidden group-hover:flex items-center gap-1 opacity-60">
                                <button 
                                  onClick={() => startEditingSubstep(idx, sIdx, sub)} 
                                  className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                  title="Edit"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                  </svg>
                                </button>
                                <button 
                                  onClick={() => moveSubstep(idx, sIdx, -1)} 
                                  disabled={sIdx === 0}
                                  className={`p-1 rounded ${sIdx === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                  title="Move Up"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                  </svg>
                                </button>
                                <button 
                                  onClick={() => moveSubstep(idx, sIdx, 1)} 
                                  disabled={sIdx === step.substeps.length - 1}
                                  className={`p-1 rounded ${sIdx === step.substeps.length - 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                  title="Move Down"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </button>
                                <button 
                                  onClick={() => deleteSubstep(idx, sIdx)} 
                                  className="p-1 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                                  title="Delete"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* Add Substep Button */}
                    <button 
                      onClick={() => addSubstep(idx)}
                      className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                         <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                       </svg>
                       Add Step
                    </button>
                  </div>

                  {step.tip && (
                    <div className="flex items-start gap-2 text-sm text-indigo-600 bg-indigo-50 p-3 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-semibold">Pro Tip:</span> {step.tip}
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-slate-100 pt-6">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">
                    Visualize Progress
                  </h4>
                  <StepVisualizer 
                    step={step} 
                    base64Context={idx === 0 ? currentImage?.base64 : stepVisuals[idx]}
                    isLocked={idx > 0 && !stepVisuals[step.stepNumber - 1]} // Locked if previous step not visualized
                    isGenerating={generatingStepIndex === step.stepNumber}
                    onGenerate={(url) => handleStepVisualGenerated(step.stepNumber, url)}
                    existingImage={stepVisuals[step.stepNumber]}
                    previousContext={plan.steps.slice(0, idx).map(s => s.instruction).join(". ")}
                  />
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Project Completion Dashboard */}
        {isFinalStepVisualized() && plan && (
            <section className="bg-slate-900 text-white rounded-2xl p-8 mb-12 overflow-hidden relative break-inside-avoid">
                <div className="absolute top-0 right-0 p-32 bg-indigo-600/20 blur-3xl rounded-full pointer-events-none -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 p-32 bg-purple-600/20 blur-3xl rounded-full pointer-events-none -ml-16 -mb-16"></div>

                <div className="relative z-10">
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                       </svg>
                       Project Transformation Complete
                    </h2>
                    <p className="text-slate-400 mb-8 max-w-2xl">
                        Your DIY plan has been fully visualized. Review the transformation summary or generate a cinematic night tour of your new space.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Action 1: Summary Audio Slideshow */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors flex flex-col items-start">
                            <div className="w-12 h-12 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                               </svg>
                            </div>
                            <h3 className="text-lg font-bold mb-2">Instructions Summary</h3>
                            <p className="text-sm text-slate-400 mb-6 flex-1">
                                Listen to an AI-narrated summary of your project plan while watching the transformation unfold step-by-step.
                            </p>
                            <button 
                                onClick={handleGenerateSummary}
                                disabled={isSummaryLoading}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
                            >
                                {isSummaryLoading ? (
                                    <>
                                       <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                       Generating Audio...
                                    </>
                                ) : (
                                    <>
                                       Play Summary
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Action 2: Night Tour Video */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors flex flex-col items-start">
                            <div className="w-12 h-12 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                               </svg>
                            </div>
                            <h3 className="text-lg font-bold mb-2">Cinematic Night Tour</h3>
                            <p className="text-sm text-slate-400 mb-6 flex-1">
                                Generate a photorealistic 4K video tour of the final result with cozy night lighting and camera movement.
                            </p>
                            
                            {nightVideoUrl ? (
                                <div className="w-full rounded-lg overflow-hidden border border-purple-500/30">
                                   <video src={nightVideoUrl} controls autoPlay muted className="w-full" />
                                </div>
                            ) : (
                                <button 
                                    onClick={handleGenerateNightTour}
                                    disabled={isNightVideoLoading}
                                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                >
                                    {isNightVideoLoading ? (
                                        <>
                                           <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                           Rendering Video...
                                        </>
                                    ) : (
                                        <>
                                           Generate Video
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        )}
        
      </main>

      {/* Summary Player Modal */}
      <SummaryPlayer 
         isOpen={showSummaryPlayer}
         onClose={() => setShowSummaryPlayer(false)}
         images={Object.values(stepVisuals)}
         audioBuffer={summaryAudioBuffer}
      />

      {/* Material Modal */}
      {selectedMaterial && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={closeMaterialModal}>
           <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900">{selectedMaterial.name}</h3>
                <button onClick={closeMaterialModal} className="text-slate-400 hover:text-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="aspect-square bg-slate-50 rounded-xl mb-4 flex items-center justify-center overflow-hidden border border-slate-100 relative">
                 {generatingMaterialImage ? (
                   <div className="flex flex-col items-center">
                     <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                     <span className="text-xs text-slate-500">Generating product shot...</span>
                   </div>
                 ) : materialImages[selectedMaterial.name] ? (
                   <img src={materialImages[selectedMaterial.name]} alt={selectedMaterial.name} className="w-full h-full object-contain" />
                 ) : (
                   <span className="text-xs text-slate-400">Image not available</span>
                 )}
              </div>

              <div className="space-y-3">
                 <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 text-sm">Estimated Cost</span>
                    <span className="font-semibold text-slate-800">{selectedMaterial.estimatedCost}</span>
                 </div>
                 <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-500 text-sm">Quantity</span>
                    <span className="font-semibold text-slate-800">{selectedMaterial.quantity}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-slate-500 text-sm">Category</span>
                    <span className="font-semibold text-slate-800 capitalize">{selectedMaterial.category}</span>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;