import { useState, useRef, type FC } from "react";
import './GlassDropdown.css';

interface GlassDropdownProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const GlassDropdown: FC<GlassDropdownProps> = ({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = "Select...",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Only close if clicking outside the dropdown
    if (!dropdownRef.current?.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={dropdownRef}
      className={`glass-dropdown ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''} ${className}`}
      onClick={handleToggle}
      tabIndex={disabled ? -1 : 0}
      onBlur={handleBlur}
    >
      <span className="selected-value">{value || placeholder}</span>
      <span className="dropdown-arrow">▼</span>

      {isOpen && !disabled && (
        <div className="dropdown-options">
          {options.map(option => (
            <div
              key={option}
              className={`dropdown-option ${option === value ? 'selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(option);
              }}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GlassDropdown;
