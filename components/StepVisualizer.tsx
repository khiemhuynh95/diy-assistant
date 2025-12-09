import React, { useState, useEffect } from 'react';
import { generateStepImage } from '../services/geminiService';
import { Step } from '../types';

interface StepVisualizerProps {
  step: Step;
  base64Context?: string;
  isLocked: boolean;
  isGenerating: boolean;
  onGenerate: (imageUrl: string) => void;
  existingImage?: string; // If the parent already has an image for this step
}

export const StepVisualizer: React.FC<StepVisualizerProps> = ({ 
  step, 
  base64Context, 
  isLocked, 
  isGenerating,
  onGenerate,
  existingImage
}) => {
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Customization State
  const [showOptions, setShowOptions] = useState(false);
  const [lighting, setLighting] = useState('Match Reference');
  const [cameraAngle, setCameraAngle] = useState('Match Reference');

  const isLoading = isGenerating || internalLoading;

  const handleGenerate = async () => {
    setInternalLoading(true);
    setError(null);
    try {
      // Pass the context (either original image or previous step) and options to the service
      const url = await generateStepImage(
        step.visualizationPrompt, 
        base64Context, 
        { lighting, cameraAngle }
      );
      onGenerate(url);
    } catch (err) {
      console.error(err);
      setError("Failed to generate visual. Please try again.");
    } finally {
      setInternalLoading(false);
    }
  };

  const renderOptions = () => (
    <div className="mb-4 p-3 bg-white rounded-lg border border-slate-200 text-sm animate-fade-in-up">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Lighting</label>
          <select 
            value={lighting} 
            onChange={(e) => setLighting(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700 bg-slate-50"
          >
            <option value="Match Reference">Match Reference</option>
            <option value="Natural Daylight">Natural Daylight</option>
            <option value="Warm Indoor">Warm Indoor</option>
            <option value="Cool White">Cool White</option>
            <option value="Bright Afternoon">Bright Afternoon</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Angle</label>
          <select 
            value={cameraAngle} 
            onChange={(e) => setCameraAngle(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none text-slate-700 bg-slate-50"
          >
            <option value="Match Reference">Match Reference</option>
            <option value="Eye Level">Eye Level</option>
            <option value="Low Angle">Low Angle</option>
            <option value="High Angle">High Angle</option>
            <option value="Wide Angle">Wide Angle</option>
          </select>
        </div>
      </div>
    </div>
  );

  if (existingImage) {
    return (
      <div className="w-full mt-4 rounded-xl overflow-hidden shadow-md border border-slate-200 group relative">
        <img 
          src={existingImage} 
          alt={`Visual for ${step.title}`} 
          className="w-full h-auto object-cover animate-fade-in"
        />
        
        {/* Controls Overlay on Hover */}
        <div className="absolute top-0 left-0 w-full p-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-black/20 to-transparent">
          <button 
             onClick={() => setShowOptions(!showOptions)}
             className="mr-2 bg-white/90 text-slate-700 hover:text-indigo-600 text-xs px-3 py-1.5 rounded-full shadow-sm font-medium flex items-center gap-1 backdrop-blur-sm"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
             </svg>
             Settings
          </button>
          <button 
             onClick={handleGenerate}
             disabled={isLoading}
             className="bg-white/90 text-slate-700 hover:text-indigo-600 text-xs px-3 py-1.5 rounded-full shadow-sm font-medium flex items-center gap-1 backdrop-blur-sm"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
             </svg>
             {isLoading ? '...' : 'Regenerate'}
          </button>
        </div>

        {/* Options Overlay */}
        {showOptions && (
           <div className="absolute top-12 right-2 left-2 z-10 shadow-xl">
             {renderOptions()}
           </div>
        )}

        <div className="p-2 bg-slate-50 text-xs text-slate-500 text-center border-t border-slate-100">
          AI Generated visualization (Step {step.stepNumber})
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-4 w-full rounded-xl border-2 border-dashed flex flex-col p-6 transition-colors ${
      isLocked 
        ? 'bg-slate-50 border-slate-200 items-center justify-center h-48' 
        : isLoading 
          ? 'bg-indigo-50/50 border-indigo-200'
          : 'bg-white border-slate-300 hover:border-indigo-300'
    }`}>
      {isLoading ? (
        <div className="flex flex-col items-center animate-pulse py-8">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-sm text-slate-600 font-medium">Rendering visualization...</p>
          <p className="text-xs text-slate-400 mt-1">Evolving your room...</p>
        </div>
      ) : isLocked ? (
        <div className="flex flex-col items-center opacity-60 text-center">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
           </svg>
           <p className="text-sm text-slate-500 font-medium">Pending previous steps</p>
           <p className="text-xs text-slate-400">Sequential generation queued</p>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center w-full">
          <p className="text-sm text-slate-600 font-medium mb-3">
            Visualization Scheduled
          </p>
          
          {showOptions && <div className="w-full max-w-sm text-left">{renderOptions()}</div>}

          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          
          <div className="flex gap-2">
             {/* If not auto-generating, provide manual controls */}
            {!showOptions && (
              <button 
                onClick={() => setShowOptions(true)}
                className="px-3 py-2 bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                Customize
              </button>
            )}
            <button
              onClick={handleGenerate}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Manually Visualize
            </button>
          </div>
        </div>
      )}
    </div>
  );
};