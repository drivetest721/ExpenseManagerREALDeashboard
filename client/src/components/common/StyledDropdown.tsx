/**
 * StyledDropdown - Custom dropdown component with full styling control
 * Features: Green theme, hover effects, animated transitions
 */
import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface StyledDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function StyledDropdown({ 
  value, 
  onChange, 
  options, 
  placeholder = '— Select —', 
  disabled = false, 
  className = '' 
}: StyledDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  const handleSelect = (optValue: string, optDisabled?: boolean) => {
    if (!optDisabled && !disabled) {
      onChange(optValue);
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2.5 pr-10 border-2 rounded-lg text-xs font-medium text-left
          transition-all duration-200 shadow-sm
          ${disabled 
            ? 'bg-gray-100 border-gray-300 cursor-not-allowed text-gray-400' 
            : isOpen
              ? 'border-[#00703C] bg-gradient-to-b from-white to-green-50 shadow-lg ring-2 ring-[#00703C]/20'
              : 'border-gray-300 bg-white hover:border-[#00703C] hover:shadow-md hover:bg-gradient-to-b hover:from-white hover:to-green-50/30'
          }
          ${!value ? 'text-gray-400 italic' : 'text-gray-900'}
        `}
      >
        {displayText}
      </button>

      {/* Dropdown Icon */}
      <ChevronDown 
        className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-all duration-200
          ${disabled ? 'text-gray-300' : isOpen ? 'text-[#00703C] rotate-180' : 'text-gray-400'}
        `}
      />

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-[#00703C] rounded-lg shadow-2xl max-h-64 overflow-auto animate-fadeIn">
          <div className="py-1">
            {/* Placeholder Option */}
            {placeholder && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="w-full px-4 py-3 text-left text-xs font-medium text-gray-400 italic
                  hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-50 hover:text-gray-600
                  transition-all duration-150"
              >
                {placeholder}
              </button>
            )}
            
            {/* Options */}
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value, opt.disabled)}
                disabled={opt.disabled}
                className={`w-full px-4 py-3 text-left text-xs font-medium border-l-4 transition-all duration-150
                  ${opt.disabled
                    ? 'text-gray-300 cursor-not-allowed bg-gray-50 border-transparent'
                    : value === opt.value
                      ? 'bg-gradient-to-r from-[#00703C] to-[#005a30] text-white border-yellow-400 font-bold shadow-inner'
                      : 'text-gray-700 border-transparent hover:bg-gradient-to-r hover:from-[#00703C] hover:to-[#007d43] hover:text-white hover:border-white hover:pl-6 hover:font-semibold hover:shadow-md'
                  }
                `}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
