import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface RawMetadataViewerProps {
  data: Record<string, unknown> | object;
  title?: string;
  defaultExpanded?: boolean;
}

export const RawMetadataViewer: React.FC<RawMetadataViewerProps> = ({
  data,
  title = 'View raw metadata',
  defaultExpanded = false
}) => {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 text-left text-xs font-semibold text-[#526175] hover:text-[#10213A] hover:bg-slate-100/60 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          <span>{title}</span>
        </div>
        {isOpen && (
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
            title="Copy formatted JSON"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy JSON</span>
              </>
            )}
          </button>
        )}
      </button>

      {isOpen && (
        <div className="p-4 bg-slate-900 text-slate-100 border-t border-slate-200 overflow-x-auto">
          <pre className="font-mono text-xs leading-relaxed selection:bg-blue-500/30">
            {jsonString}
          </pre>
        </div>
      )}
    </div>
  );
};

export const HashViewer: React.FC<{ hash: string; label?: string }> = ({ hash, label = 'SHA-256' }) => {
  const [copied, setCopied] = useState(false);
  const shortened = hash.length > 16 ? `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}` : hash;

  const handleCopy = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-600 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/80">
      <span className="text-slate-400 font-sans text-[10px] uppercase font-semibold">{label}</span>
      <span title={hash}>{shortened}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="text-slate-400 hover:text-slate-700 ml-0.5"
        title="Copy complete SHA-256 hash"
        aria-label="Copy hash"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
};
