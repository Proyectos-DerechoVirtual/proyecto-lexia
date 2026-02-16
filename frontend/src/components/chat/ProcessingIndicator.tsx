interface ProcessingIndicatorProps {
  step: { message: string; step: number; total: number; estimated?: string };
}

export function ProcessingIndicator({ step }: ProcessingIndicatorProps) {
  const progress = (step.step / step.total) * 100;

  return (
    <div className="flex gap-4 mb-6">
      <div className="flex-shrink-0">
        {/* Espacio vacío para mantener la alineación */}
        <div className="w-8 h-8"></div>
      </div>

      <div className="flex-1 max-w-3xl">
        <div className="rounded-2xl px-4 py-3 bg-white dark:bg-claude-gray-800 text-claude-gray-700 dark:text-claude-gray-200 border border-claude-gray-200 dark:border-claude-gray-700">
          
          {/* Advertencia de tiempo */}
          <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs text-green-800 dark:text-green-200">
            <strong>⏱️ Tiempo estimado:</strong> La respuesta puede tardar entre 3-7 segundos debido al análisis de documentos legales.
          </div>

          {/* Progreso */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium">{step.message}</span>
              <span className="text-xs text-claude-gray-500">
                {step.step}/{step.total}
                {step.estimated && ` • ${step.estimated}`}
              </span>
            </div>
            
            <div className="w-full bg-claude-gray-200 dark:bg-claude-gray-600 rounded-full h-2">
              <div 
                className="bg-[#64c27b] h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Pasos específicos */}
          <div className="grid grid-cols-3 gap-2 text-xs text-claude-gray-500">
            <div className={`flex items-center gap-1 ${step.step >= 1 ? 'text-[#64c27b]' : ''}`}>
              <div className={`w-2 h-2 rounded-full ${step.step >= 1 ? 'bg-[#64c27b]' : 'bg-claude-gray-300'}`}></div>
              Verificación
            </div>
            <div className={`flex items-center gap-1 ${step.step >= 3 ? 'text-[#64c27b]' : ''}`}>
              <div className={`w-2 h-2 rounded-full ${step.step >= 3 ? 'bg-[#64c27b]' : 'bg-claude-gray-300'}`}></div>
              Buscando Documentos
            </div>
            <div className={`flex items-center gap-1 ${step.step >= 6 ? 'text-[#64c27b]' : ''}`}>
              <div className={`w-2 h-2 rounded-full ${step.step >= 6 ? 'bg-[#64c27b]' : 'bg-claude-gray-300'}`}></div>
              Generando IA
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}