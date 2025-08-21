import type { FC } from "react";
import { useState, useRef } from "react";
import type { Message } from "../types";
import UsageDetailsDropdown from "./UsageDetailsDropdown";
import "./MetricsDisplay.css";

interface MetricsDisplayProps {
  message: Message;
}

const MetricsDisplay: FC<MetricsDisplayProps> = ({ message }) => {
  const [showUsageDetails, setShowUsageDetails] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const priceRef = useRef<HTMLSpanElement>(null);

  const handlePriceClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (priceRef.current) {
      // Get fresh rect each time to ensure accuracy
      const rect = priceRef.current.getBoundingClientRect();
      setAnchorRect(rect);
      setShowUsageDetails(true);
    }
  };

  const handleCloseUsageDetails = () => {
    setShowUsageDetails(false);
    // Clear anchor rect after a brief delay to allow for exit animation
    setTimeout(() => setAnchorRect(null), 200);
  };

  return (
    <div className="metrics-container">
      <div className="metrics">
        {(message.input_tokens != null || message.output_tokens != null) && (
          <span className="metric-item">
            Tokens: {(message.input_tokens || 0) + (message.output_tokens || 0)}
            {message.input_tokens != null && message.output_tokens != null &&
              ` (${message.input_tokens}→${message.output_tokens})`
            }
            {message.cached_tokens != null && message.cached_tokens > 0 &&
              ` +${message.cached_tokens} cached`
            }
          </span>
        )}
        {message.price != null && (
          <span
            ref={priceRef}
            className={`metric-item price-clickable ${showUsageDetails ? 'expanded' : ''}`}
            onClick={handlePriceClick}
            title="Click to see detailed usage breakdown"
          >
            Price: ${message.price.toFixed(6)}
          </span>
        )}
        {message.model && (
          <span className="metric-item model-info">
            Model: {message.model}
          </span>
        )}
      </div>

      {showUsageDetails && (
        <UsageDetailsDropdown
          messageId={message.id}
          isOpen={showUsageDetails}
          onClose={handleCloseUsageDetails}
          anchorRect={anchorRect}
        />
      )}
    </div>
  );
};

export default MetricsDisplay;
