import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  required?: boolean;
}

export default function MultiSelect({ options, selected, onChange, placeholder = 'Select options', required = false }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div className="multi-select-container" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        className="form-group" 
        onClick={() => setOpen(!open)}
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        <div style={{
          padding: '11px 14px',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '14px',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '44px',
          color: selected.length === 0 ? 'var(--text-muted)' : 'var(--text)'
        }}>
          <span style={{ 
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            paddingRight: '24px'
          }}>
            {selected.length === 0 ? placeholder : selected.join(', ')}
          </span>
          <ChevronDown size={16} style={{ color: 'var(--text-muted)', position: 'absolute', right: '14px' }} />
        </div>
        {required && selected.length === 0 && (
           <input type="text" required style={{ opacity: 0, position: 'absolute', pointerEvents: 'none', height: 0, width: 0 }} />
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-lg)',
          maxHeight: '220px',
          overflowY: 'auto',
          zIndex: 100
        }}>
          {options.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-muted)' }}>No options available</div>
          ) : (
            options.map(option => {
              const isSelected = selected.includes(option);
              return (
                <div 
                  key={option}
                  onClick={() => toggleOption(option)}
                  style={{
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(30,58,95,0.05)' : 'transparent',
                    fontSize: '14px',
                    color: 'var(--text)',
                    borderBottom: '1px solid var(--border-light)'
                  }}
                >
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '4px',
                    border: `1.5px solid ${isSelected ? 'var(--navy)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--navy)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {isSelected && <Check size={12} color="#fff" />}
                  </div>
                  {option}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
