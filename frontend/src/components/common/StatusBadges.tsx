import React from 'react';
import { DataClassification, QcStatus, SessionStatus, EnrollmentStatus } from '../../types';
import { ShieldCheck, AlertCircle, CheckCircle2, Clock, Database, Sparkles, HelpCircle } from 'lucide-react';

export const ProvenanceBadge: React.FC<{ classification: DataClassification; className?: string }> = ({ 
  classification, 
  className = '' 
}) => {
  switch (classification) {
    case 'REAL':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 ${className}`}>
          <Database className="w-3 h-3 text-emerald-600" />
          REAL
        </span>
      );
    case 'SYNTHETIC':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 ${className}`}>
          <Sparkles className="w-3 h-3 text-amber-600" />
          SYNTHETIC
        </span>
      );
    case 'DEMO':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 ${className}`}>
          <HelpCircle className="w-3 h-3 text-slate-500" />
          DEMO
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200 ${className}`}>
          UNCLASSIFIED
        </span>
      );
  }
};

export const QcBadge: React.FC<{ status: QcStatus; className?: string }> = ({ status, className = '' }) => {
  switch (status) {
    case 'QC_PASS':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 ${className}`}>
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          QC PASS
        </span>
      );
    case 'QC_WARNING':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 ${className}`}>
          <AlertCircle className="w-3 h-3 text-amber-600" />
          QC WARNING
        </span>
      );
    case 'QC_FAIL':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 ${className}`}>
          <AlertCircle className="w-3 h-3 text-rose-600" />
          QC FAIL
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 ${className}`}>
          QC UNKNOWN
        </span>
      );
  }
};

export const SessionStatusBadge: React.FC<{ status: SessionStatus; className?: string }> = ({ status, className = '' }) => {
  switch (status) {
    case 'completed':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/70 ${className}`}>
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Completed
        </span>
      );
    case 'in_progress':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/70 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
          In Progress
        </span>
      );
    case 'scheduled':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200/70 ${className}`}>
          <Clock className="w-3 h-3 text-sky-600" />
          Scheduled
        </span>
      );
    case 'planned':
    default:
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 ${className}`}>
          <Clock className="w-3 h-3 text-slate-500" />
          Planned
        </span>
      );
  }
};

export const EnrollmentBadge: React.FC<{ status: EnrollmentStatus; className?: string }> = ({ status, className = '' }) => {
  switch (status) {
    case 'enrolled':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/70 ${className}`}>
          Enrolled in Study
        </span>
      );
    case 'local_practice':
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 ${className}`}>
          Local Practice
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200 ${className}`}>
          Not Enrolled
        </span>
      );
  }
};
