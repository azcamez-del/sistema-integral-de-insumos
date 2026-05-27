import React, { useState, useEffect, useRef } from 'react';

interface AutocompleteNode {
  descripcion: string;
  unidad: string;
  actual?: number;
}

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  onSelect: (item: AutocompleteNode) => void;
  suggestions: AutocompleteNode[];
  placeholder: string;
  isSalida: boolean;
  disabled?: boolean;
}

export default function AutocompleteInput({
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder,
  isSalida,
  disabled = false
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input value
  const filteredSuggestions = suggestions.filter(item => {
    const query = value.toUpperCase();
    return item.descripcion.toUpperCase().includes(query);
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full text-xs md:text-sm border-1.5 border-[#ddd9d0] rounded-lg px-2.5 py-2 focus:border-blue-600 focus:bg-white focus:outline-none transition-colors uppercase"
      />

      {isOpen && value.trim() !== '' && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-blue-600 rounded-lg max-h-56 overflow-y-auto shadow-xl">
          {filteredSuggestions.length === 0 ? (
            <div className="p-3 text-xs text-center">
              {isSalida ? (
                <span className="text-red-600 font-medium">⚠️ No hay stock o requiere ingreso previo.</span>
              ) : (
                <span className="text-green-600 font-medium">📝 Producto nuevo - Al guardar, se agregará de forma automática al catálogo general.</span>
              )}
            </div>
          ) : (
            filteredSuggestions.slice(0, 8).map((item, idx) => (
              <div
                key={idx}
                onMouseDown={() => {
                  onSelect(item);
                  setIsOpen(false);
                }}
                className="flex justify-between items-center px-3 py-2 text-xs md:text-sm hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{item.descripcion}</span>
                  <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                    {item.unidad}
                  </span>
                </div>
                {isSalida && item.actual !== undefined && (
                  <span className="font-bold text-xs text-blue-600">
                    Stock: {item.actual}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
