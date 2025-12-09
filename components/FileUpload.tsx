import React from 'react';
import { ImageInput } from '../types';

interface FileUploadProps {
  label: string;
  description: string;
  imageInput: ImageInput | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  label, 
  description, 
  imageInput, 
  onFileSelect, 
  onClear 
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-semibold text-slate-700 mb-1">
        {label}
      </label>
      <p className="text-xs text-slate-500 mb-2">{description}</p>
      
      {imageInput ? (
        <div className="relative group rounded-xl overflow-hidden shadow-sm border border-slate-200">
          <img 
            src={imageInput.previewUrl} 
            alt="Preview" 
            className="w-full h-48 object-cover"
          />
          <button 
            onClick={onClear}
            className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white text-red-500 rounded-full shadow-md transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Remove image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className="w-8 h-8 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            <p className="text-sm text-slate-500"><span className="font-semibold">Click to upload</span></p>
            <p className="text-xs text-slate-400 mt-1">JPEG, PNG</p>
          </div>
          <input 
            type="file" 
            className="hidden" 
            accept="image/*"
            onChange={handleInputChange} 
          />
        </label>
      )}
    </div>
  );
};