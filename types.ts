export interface Material {
  name: string;
  quantity: string;
  estimatedCost: string;
  category: 'tool' | 'consumable' | 'furniture' | 'decor';
}

export interface Step {
  stepNumber: number;
  title: string;
  instruction: string; // High level summary
  substeps: string[]; // Detailed breakdown
  safetyWarning?: string;
  requiredTools?: string[];
  tip?: string;
  visualizationPrompt: string; // The prompt to send to Gemini Image model
  difficulty: 'Easy' | 'Medium' | 'Hard';
  estimatedTime: string;
}

export interface DIYPlan {
  projectTitle: string;
  description: string;
  styleAnalysis: string; // New field for style summary
  difficultyLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedTime: string;
  estimatedTotalCost: string;
  materials: Material[];
  steps: Step[];
}

export interface ImageInput {
  file: File;
  previewUrl: string;
  base64: string;
}

export enum AppState {
  INPUT = 'INPUT',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT',
  ERROR = 'ERROR'
}