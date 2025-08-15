import type { FC } from "react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { UsageDetail } from "../types";
import "./UsageDetailsDropdown.css";

interface UsageDetailsDropdownProps {
  messageId: number;
  isOpen: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
}

const UsageDetailsDropdown: FC<UsageDetailsDropdownProps> = ({ 
  messageId, 
  isOpen, 
  onClose, 
  anchorRect 
}) => {
  const [usageDetails, setUsageDetails] = useState<UsageDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsageDetails = async () => {
    if (!isOpen || usageDetails.length > 0) return; // Don't fetch if already loaded
    
    setLoading(true);
    setError(null);
    
    try {
  const { fetchJson } = await import('../lib/api');
  const data = await fetchJson(`/chat/messages/${messageId}/usage-details`);
      setUsageDetails(data.usage_details || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsageDetails();
    }
  }, [isOpen, messageId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Close if clicked outside both the dropdown and the trigger button
      if (!target.closest('.usage-details-overlay') && !target.closest('.price-clickable')) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const handleScroll = (event: Event) => {
      // Only close if scrolling outside the dropdown content
      const target = event.target as Element;
      if (!target.closest('.usage-details-overlay')) {
        onClose();
      }
    };

    const handleResize = () => {
      // Close dropdown on resize to prevent positioning issues
      onClose();
    };

    if (isOpen) {
      // Add class to body to prevent interference from other components
      document.body.classList.add('usage-dropdown-open');
      
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('scroll', handleScroll, true); // Use capture phase
      window.addEventListener('resize', handleResize);
    }

    return () => {
      // Remove class from body
      document.body.classList.remove('usage-dropdown-open');
      
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !anchorRect) return null;

  const getScopeLabel = (scope: string) => {
    switch (scope) {
      case 'title': return 'Title Generation';
      case 'intent': return 'Intent Detection';
      case 'summary': return 'Summary';
      case 'tool': return 'Tool Call';
      case 'final': return 'Final Response';
      default: return scope;
    }
  };

  // Calculate position relative to the viewport when using portal
  const dropdownStyle: React.CSSProperties = {
    position: 'fixed', // Use fixed positioning for portal
    zIndex: 999999, // Extremely high z-index to ensure it's above everything
    minWidth: '520px', // Increased even more
    maxWidth: '650px', // Increased even more
    // Position relative to the button's position in viewport
    left: anchorRect.left + anchorRect.width / 2,
    transform: 'translateX(-50%)', // Center horizontally relative to button
  };

  // Calculate if we should show above or below the button
  const viewportHeight = window.innerHeight;
  const buttonBottom = anchorRect.bottom;
  const buttonTop = anchorRect.top;
  const dropdownHeight = 300;
  
  const spaceBelow = viewportHeight - buttonBottom;
  const spaceAbove = buttonTop;
  
  if (spaceBelow >= dropdownHeight + 16 || spaceBelow > spaceAbove) {
    // Show below the button
    dropdownStyle.top = buttonBottom + 8;
    dropdownStyle.maxHeight = Math.min(dropdownHeight, spaceBelow - 24);
  } else {
    // Show above the button
    dropdownStyle.bottom = viewportHeight - buttonTop + 8;
    dropdownStyle.maxHeight = Math.min(dropdownHeight, spaceAbove - 24);
  }

  return createPortal(
    <div className="usage-details-overlay" style={dropdownStyle}>
      <div className="usage-details-header">
        <h4>Usage Breakdown</h4>
        <button onClick={onClose} className="close-btn" aria-label="Close usage details">
          ×
        </button>
      </div>
      <div className="usage-details-content">
        {loading && <div className="loading">Loading...</div>}
        {error && <div className="error">Error: {error}</div>}
        {!loading && !error && usageDetails.length === 0 && (
          <div className="no-data">No usage details found</div>
        )}
        {!loading && !error && usageDetails.length > 0 && (
          <table className="usage-details-table">
            <thead>
              <tr>
                <th>Scope</th>
                <th>Model</th>
                <th>In</th>
                <th>Out</th>
                <th>Cache</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {usageDetails.map((detail) => (
                <tr key={detail.id}>
                  <td>{getScopeLabel(detail.scope)}</td>
                  <td className="model-cell">{detail.model}</td>
                  <td className="token-cell">{detail.input_tokens}</td>
                  <td className="token-cell">{detail.output_tokens}</td>
                  <td className="token-cell">{detail.cached_tokens}</td>
                  <td className="price-cell">${detail.price.toFixed(6)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td><strong>Total</strong></td>
                <td>-</td>
                <td className="token-cell"><strong>{usageDetails.reduce((sum, d) => sum + d.input_tokens, 0)}</strong></td>
                <td className="token-cell"><strong>{usageDetails.reduce((sum, d) => sum + d.output_tokens, 0)}</strong></td>
                <td className="token-cell"><strong>{usageDetails.reduce((sum, d) => sum + d.cached_tokens, 0)}</strong></td>
                <td className="price-cell"><strong>${usageDetails.reduce((sum, d) => sum + d.price, 0).toFixed(6)}</strong></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>,
    document.body
  );
};

export default UsageDetailsDropdown;
