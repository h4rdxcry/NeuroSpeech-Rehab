import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { RehabStage, RehabLevel } from '../../types';
import { MilestoneModal } from './MilestoneModal';
import { MilestoneCelebration } from './MilestoneCelebration';
import { 
  Check, 
  Lock, 
  Play, 
  Compass, 
  Volume2, 
  ArrowRight, 
  Award, 
  Layers, 
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';

interface ViewJourneyProps {
  onSelectLevel?: (levelNum: number) => void;
  isModal?: boolean;
}

interface JourneyGridCellProps {
  lvl: RehabLevel;
  isCompleted: boolean;
  isCurrent: boolean;
  isUnlocked: boolean;
  isInspected: boolean;
  onClick: (lvl: RehabLevel) => void;
}

const JourneyGridCell: React.FC<JourneyGridCellProps> = ({
  lvl,
  isCompleted,
  isCurrent,
  isUnlocked,
  isInspected,
  onClick,
}) => {
  const isLocked = !isUnlocked;
  const isMilestone = [10, 25, 50, 75, 100].includes(lvl.level);

  const statusDesc = isCurrent
    ? 'Current active exercise'
    : isCompleted
      ? 'Completed level'
      : isUnlocked
        ? 'Unlocked exercise'
        : 'Locked future exercise';

  return (
    <button
      type="button"
      onClick={() => onClick(lvl)}
      aria-label={`Level ${lvl.level}: ${lvl.targetText}, ${lvl.languageName}. ${statusDesc}`}
      aria-current={isCurrent ? 'step' : undefined}
      aria-disabled={isLocked}
      title={`Level ${lvl.level}: ${lvl.targetText} (${lvl.languageName}) • ${statusDesc}`}
      className={`relative group flex flex-col items-center justify-between p-2 sm:p-2.5 rounded-2xl border transition-all duration-200 text-center select-none backdrop-blur-md ${
        isCurrent
          ? 'bg-gradient-to-b from-blue-600/15 via-blue-50/95 to-indigo-50/85 border-[#2563EB] ring-2 ring-[#2563EB]/40 shadow-[0_0_22px_rgba(37,99,235,0.24),inset_0_1px_2px_rgba(255,255,255,0.95)] scale-105 z-10 text-[#10213A]'
          : isCompleted
            ? 'bg-gradient-to-b from-emerald-500/12 via-emerald-50/75 to-teal-500/10 border-emerald-300/80 hover:border-emerald-400 hover:bg-emerald-50/90 text-emerald-950 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_2px_8px_rgba(16,185,129,0.06)] hover:shadow-xs'
            : isUnlocked
              ? 'bg-white/90 border-slate-200/90 hover:border-blue-300 hover:bg-blue-50/30 text-slate-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.95),0_1px_3px_rgba(16,33,58,0.04)] hover:shadow-xs'
              : 'opacity-45 bg-slate-100/40 border-slate-200/50 text-slate-400 cursor-not-allowed hover:border-slate-200/50 shadow-none'
      } ${isInspected && !isCurrent ? 'ring-2 ring-slate-400/50 shadow-sm' : ''} focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:outline-none`}
    >
      {/* Top Header: Level # & Language Indicator */}
      <div className="w-full flex items-center justify-between text-[10px] leading-none mb-1">
        <div className="flex items-center gap-1">
          <span className={`font-bold ${
            isCurrent ? 'text-[#2563EB]' : isCompleted ? 'text-emerald-700' : isUnlocked ? 'text-slate-600' : 'text-slate-400'
          }`}>
            #{lvl.level}
          </span>
          {isCurrent && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-pulse" title="Active Focus" />
          )}
        </div>

        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-xs transition-colors ${
          lvl.language === 'ta-IN' 
            ? 'bg-amber-100/90 text-amber-900 border border-amber-200/60' 
            : 'bg-blue-100/90 text-blue-900 border border-blue-200/60'
        }`}>
          {lvl.language === 'ta-IN' ? 'த' : 'EN'}
        </span>
      </div>

      {/* Center Marker: Distinctive Clinical Status Indicator */}
      <div className="my-1 sm:my-1.5 flex items-center justify-center relative">
        {isCompleted ? (
          /* Checkmark badge with clinical emerald frosted styling */
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-xs ring-2 ring-emerald-200/70">
            <Check className="w-4 h-4 stroke-[3]" />
          </div>
        ) : isCurrent ? (
          /* Current active marker with subtle pulse & glowing radar ring */
          <div className="relative flex items-center justify-center">
            <span className="absolute -inset-0.5 rounded-full bg-blue-500/20 animate-ping pointer-events-none" />
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#2563EB] to-blue-600 text-white flex items-center justify-center shadow-sm ring-2 ring-blue-300/80 animate-pulse">
              <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
            </div>
          </div>
        ) : isUnlocked ? (
          /* Unlocked next exercise marker */
          <div className="w-7 h-7 rounded-full bg-slate-100/90 border border-slate-200/80 text-slate-700 font-bold text-[11px] flex items-center justify-center group-hover:border-blue-300 group-hover:text-[#2563EB] group-hover:bg-blue-50/80 transition-colors">
            {lvl.level}
          </div>
        ) : (
          /* Locked future exercise marker */
          <div className="w-7 h-7 rounded-full bg-slate-200/60 border border-slate-300/40 text-slate-400 flex items-center justify-center">
            <Lock className="w-3.5 h-3.5 text-slate-400/90" />
          </div>
        )}
      </div>

      {/* Target Text Snippet */}
      <span className={`text-[10px] sm:text-[11px] font-medium truncate w-full mt-0.5 ${
        lvl.language === 'ta-IN' ? 'font-tamil' : ''
      }`}>
        {lvl.targetText}
      </span>

      {/* Milestone Star Indicator (Levels 10, 25, 50, 75, 100) */}
      {isMilestone && (
        <span 
          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gradient-to-tr from-amber-400 to-amber-500 text-amber-950 rounded-full flex items-center justify-center text-[9px] font-black shadow-xs ring-1.5 ring-white"
          title="Clinical Stage Milestone"
        >
          ★
        </span>
      )}
    </button>
  );
};

export const ViewJourney: React.FC<ViewJourneyProps> = ({
  onSelectLevel,
  isModal = false,
}) => {
  const { 
    rehabLevels, 
    currentLevelNumber, 
    highestUnlockedLevel, 
    completedLevelNumbers,
    setCurrentLevelNumber,
    setActiveTab,
    addToast 
  } = useApp();

  // Active selected level for inspection preview
  const [selectedPreviewLevel, setSelectedPreviewLevel] = useState<RehabLevel>(() => {
    const current = rehabLevels.find(l => l.level === currentLevelNumber);
    return current || rehabLevels[0];
  });

  // State to preview calm milestone celebration summary modal
  const [inspectMilestoneLevel, setInspectMilestoneLevel] = useState<number | null>(null);
  const [previewCelebrationLevel, setPreviewCelebrationLevel] = useState<number | null>(null);

  // Filter by stage: 'All' or specific RehabStage
  const [selectedStage, setSelectedStage] = useState<RehabStage | 'All'>('All');
  const [viewLayout, setViewLayout] = useState<'compact' | 'grouped'>('compact');

  const completedCount = completedLevelNumbers.length;
  const progressPercent = Math.min(100, Math.round((completedCount / 100) * 100));

  const stages: { stage: RehabStage; label: string; range: string; desc: string }[] = [
    { stage: 'Beginner', label: 'Beginner', range: 'Levels 1–10', desc: 'Foundational vowels, bilateral stops & breath support' },
    { stage: 'Foundation', label: 'Foundation', range: 'Levels 11–25', desc: 'Retroflex consonants, lingual precision & rhythm' },
    { stage: 'Intermediate', label: 'Intermediate', range: 'Levels 26–50', desc: 'Polysyllabic words, common daily vocabulary & phrases' },
    { stage: 'Advanced Practice', label: 'Advanced', range: 'Levels 51–75', desc: 'Connected phrases, breath pacing & conversational stamina' },
    { stage: 'Mastery Practice', label: 'Mastery', range: 'Levels 76–100', desc: 'Fluent bilingual discourse, prosody & natural cadence' },
  ];

  const filteredLevels = selectedStage === 'All' 
    ? rehabLevels 
    : rehabLevels.filter(lvl => lvl.stage === selectedStage);

  // Play audio reference for inspected level
  const handleListenPhrase = (targetText: string, lang: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(targetText);
      utterance.lang = lang;
      utterance.rate = 0.82;
      window.speechSynthesis.speak(utterance);
    } else {
      addToast('Audio Guidance', 'Speech synthesis is not supported in this browser.', 'info');
    }
  };

  const handleLevelClick = (lvl: RehabLevel) => {
    setSelectedPreviewLevel(lvl);
    if (lvl.level <= highestUnlockedLevel && onSelectLevel) {
      // If modal or parent provided a selection callback, allow clicking to set
    }
  };

  const handleStartPractice = (levelNum: number) => {
    setCurrentLevelNumber(levelNum);
    if (onSelectLevel) {
      onSelectLevel(levelNum);
    } else {
      setActiveTab('home');
    }
  };

  return (
    <div 
      className="flex flex-col gap-5 w-full max-w-7xl mx-auto"
      role="region" 
      aria-label="100-Level Speech Rehabilitation Journey"
    >
      {/* Header & Overall Metric Bar */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[#10213A] tracking-tight">
                  100-Level Rehabilitation Journey
                </h1>
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[11px] font-bold text-[#2563EB]">
                  Sequential Curriculum
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#526175] mt-0.5">
                Progression from foundational articulatory sounds to conversational bilingual fluency.
              </p>
            </div>
          </div>

          {/* Quick Metrics & Mode Switch */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/70 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewLayout('compact')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  viewLayout === 'compact'
                    ? 'bg-white text-[#10213A] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-pressed={viewLayout === 'compact'}
              >
                100 Grid
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('grouped')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  viewLayout === 'grouped'
                    ? 'bg-white text-[#10213A] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-pressed={viewLayout === 'grouped'}
              >
                By Stage
              </button>
            </div>
          </div>
        </div>

        {/* Global Progress Line & Legend */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-6 text-xs text-slate-600 font-medium flex-wrap">
            <span>
              Completed: <strong className="text-emerald-700 font-bold">{completedCount}</strong> / 100
            </span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span>
              Current Target: <strong className="text-[#2563EB] font-bold">Level {currentLevelNumber}</strong>
            </span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span>
              Highest Unlocked: <strong className="text-[#10213A] font-bold">Level {highestUnlockedLevel}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 min-w-[200px]">
            <div className="flex-1 bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[#2563EB] to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <span className="text-xs font-bold text-[#10213A]">{progressPercent}%</span>
          </div>
        </div>

        {/* Stage Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <button
            type="button"
            onClick={() => setSelectedStage('All')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedStage === 'All'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
            }`}
          >
            All 100 Levels
          </button>

          {stages.map(st => {
            const stageCompleted = rehabLevels
              .filter(lvl => lvl.stage === st.stage)
              .filter(lvl => completedLevelNumbers.includes(lvl.level)).length;
            const stageTotal = rehabLevels.filter(lvl => lvl.stage === st.stage).length;

            return (
              <button
                key={st.stage}
                type="button"
                onClick={() => setSelectedStage(st.stage)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  selectedStage === st.stage
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                }`}
              >
                <span>{st.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedStage === st.stage 
                    ? 'bg-white/20 text-white' 
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {stageCompleted}/{stageTotal}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area: Compact Grid + Selected Level Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ==================================================== */}
        {/* COMPACT 100-LEVEL GRID (8 cols on desktop)           */}
        {/* ==================================================== */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-6 shadow-2xs flex flex-col gap-4">
            
            {/* Grid Sub-header & Status Legend */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
              <span className="font-bold text-slate-800">
                {selectedStage === 'All' ? 'Complete 100-Level Matrix' : `${selectedStage} Stage Sequence`}
              </span>

              {/* Status Visual Legend with 2026 Clinical Glassmorphic micro-badges */}
              <div className="flex items-center gap-2.5 sm:gap-4 text-slate-500 text-[11px] flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-2xs ring-1 ring-emerald-200/70">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                  <span className="font-semibold text-slate-700">Completed</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="relative flex items-center justify-center">
                    <span className="absolute -inset-0.5 rounded-full bg-blue-500/20 animate-ping pointer-events-none" />
                    <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#2563EB] to-blue-600 text-white flex items-center justify-center shadow-2xs ring-1 ring-blue-300 animate-pulse">
                      <Play className="w-2 h-2 fill-white ml-0.5" />
                    </span>
                  </span>
                  <span className="font-bold text-[#2563EB]">Current Step</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-bold flex items-center justify-center">
                    #
                  </span>
                  <span className="font-medium text-slate-600">Unlocked</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200/70 border border-slate-300/50 text-slate-400 flex items-center justify-center">
                    <Lock className="w-2.5 h-2.5" />
                  </span>
                  <span className="font-medium text-slate-400">Locked</span>
                </span>
              </div>
            </div>

            {/* COMPACT VIEW: 100 Grid Cells (Responsive 5 to 10 cols) */}
            {viewLayout === 'compact' ? (
              <div 
                className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 sm:gap-2.5"
                role="grid"
                aria-label="100 Levels Grid"
              >
                {filteredLevels.map((lvl) => (
                  <JourneyGridCell
                    key={lvl.level}
                    lvl={lvl}
                    isCompleted={completedLevelNumbers.includes(lvl.level)}
                    isCurrent={lvl.level === currentLevelNumber}
                    isUnlocked={lvl.level <= highestUnlockedLevel}
                    isInspected={selectedPreviewLevel.level === lvl.level}
                    onClick={handleLevelClick}
                  />
                ))}
              </div>
            ) : (
              /* GROUPED VIEW: Organized cleanly by the 5 Clinical Stages */
              <div className="flex flex-col gap-6">
                {stages.map((st) => {
                  const stageLevels = rehabLevels.filter(lvl => lvl.stage === st.stage);
                  const stageDoneCount = stageLevels.filter(lvl => completedLevelNumbers.includes(lvl.level)).length;

                  return (
                    <div key={st.stage} className="flex flex-col gap-2.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 backdrop-blur-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-[#10213A]">{st.label} Stage</span>
                          <span className="text-[11px] text-slate-500 ml-2 font-medium">({st.range})</span>
                        </div>
                        <span className="text-xs font-bold text-[#2563EB]">
                          {stageDoneCount} / {stageLevels.length} Completed
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 italic mb-1">{st.desc}</p>

                      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 sm:gap-2.5">
                        {stageLevels.map((lvl) => (
                          <JourneyGridCell
                            key={lvl.level}
                            lvl={lvl}
                            isCompleted={completedLevelNumbers.includes(lvl.level)}
                            isCurrent={lvl.level === currentLevelNumber}
                            isUnlocked={lvl.level <= highestUnlockedLevel}
                            isInspected={selectedPreviewLevel.level === lvl.level}
                            onClick={handleLevelClick}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ==================================================== */}
        {/* RIGHT COLUMN: INSPECTOR & QUICK PRACTICE (4 cols)   */}
        {/* ==================================================== */}
        <div className="lg:col-span-4 flex flex-col gap-4 sticky top-20">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs flex flex-col gap-4">
            
            {/* Inspector Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Level Details
              </span>

              {/* Status Badge */}
              {completedLevelNumbers.includes(selectedPreviewLevel.level) ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>Completed</span>
                </span>
              ) : selectedPreviewLevel.level === currentLevelNumber ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-bold text-[#2563EB] animate-pulse">
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>Current Active</span>
                </span>
              ) : selectedPreviewLevel.level <= highestUnlockedLevel ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  <span>Unlocked</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-400">
                  <Lock className="w-3 h-3" />
                  <span>Locked</span>
                </span>
              )}
            </div>

            {/* Target Pronunciation Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 via-white to-indigo-50/20 border border-blue-100 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#2563EB]">
                  Level {selectedPreviewLevel.level} • {selectedPreviewLevel.stage}
                </span>

                <button
                  type="button"
                  onClick={() => handleListenPhrase(selectedPreviewLevel.targetText, selectedPreviewLevel.language)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors"
                  title="Listen to native pronunciation"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Listen</span>
                </button>
              </div>

              {/* Target Text in high contrast typography */}
              <h2 className={`text-2xl sm:text-3xl font-extrabold text-[#10213A] tracking-tight mt-1 ${
                selectedPreviewLevel.language === 'ta-IN' ? 'font-tamil' : ''
              }`}>
                {selectedPreviewLevel.targetText}
              </h2>

              <div className="border-t border-blue-100/80 pt-2 flex flex-col gap-0.5">
                <span className="text-xs font-bold text-[#2563EB]">
                  {selectedPreviewLevel.phoneticGuide}
                </span>
                <span className="text-xs text-[#526175] italic">
                  “{selectedPreviewLevel.meaning}”
                </span>
              </div>
            </div>

            {/* Language & Exercise Type Info */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-semibold text-slate-400 uppercase block">Language</span>
                <span className="text-xs font-bold text-slate-800">
                  {selectedPreviewLevel.languageName}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-semibold text-slate-400 uppercase block">Exercise Type</span>
                <span className="text-xs font-bold text-slate-800 truncate block">
                  {selectedPreviewLevel.exerciseType}
                </span>
              </div>
            </div>

            {/* Guidance Tip */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <Info className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Articulatory Guidance</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                {selectedPreviewLevel.guidanceTip}
              </p>
            </div>

            {/* Milestone Level Info & Summary Launcher */}
            {[10, 25, 50, 75, 100].includes(selectedPreviewLevel.level) && (
              <button
                type="button"
                onClick={() => setPreviewCelebrationLevel(selectedPreviewLevel.level)}
                className="w-full p-3 rounded-2xl bg-amber-50/90 border border-amber-200/90 hover:bg-amber-100/80 text-amber-950 text-xs font-semibold flex items-center justify-between transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <span className="font-bold block text-[#10213A]">
                      Stage Milestone • Level {selectedPreviewLevel.level}
                    </span>
                    <span className="text-[11px] text-amber-800/90">
                      View milestone achievement & encouraging feedback
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-600 shrink-0" />
              </button>
            )}

            {/* Practice Action */}
            {selectedPreviewLevel.level <= highestUnlockedLevel ? (
              <button
                type="button"
                onClick={() => handleStartPractice(selectedPreviewLevel.level)}
                className="w-full py-3.5 px-5 rounded-2xl bg-[#2563EB] hover:bg-[#174EA6] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
              >
                <span>Practice Level {selectedPreviewLevel.level}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-slate-100 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Complete Level {selectedPreviewLevel.level - 1} to unlock</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Non-intrusive Milestone Celebration message preview */}
      <MilestoneCelebration
        level={previewCelebrationLevel || 10}
        isOpen={previewCelebrationLevel !== null}
        onClose={() => setPreviewCelebrationLevel(null)}
        onContinuePractice={() => {
          const lvl = previewCelebrationLevel || 10;
          setPreviewCelebrationLevel(null);
          handleStartPractice(lvl);
        }}
        onViewDetails={() => {
          setInspectMilestoneLevel(previewCelebrationLevel);
          setPreviewCelebrationLevel(null);
        }}
        position="bottom-right"
      />

      {/* Calm Milestone Modal Viewer */}
      {inspectMilestoneLevel !== null && (
        <MilestoneModal
          level={inspectMilestoneLevel}
          isOpen={true}
          onClose={() => setInspectMilestoneLevel(null)}
          completedCount={completedLevelNumbers.length}
          onViewProgress={() => {
            setInspectMilestoneLevel(null);
            setActiveTab('progress');
          }}
          onContinueNextLevel={() => {
            const nextLvl = Math.min(100, inspectMilestoneLevel + 1);
            setInspectMilestoneLevel(null);
            handleStartPractice(nextLvl);
          }}
        />
      )}
    </div>
  );
};
