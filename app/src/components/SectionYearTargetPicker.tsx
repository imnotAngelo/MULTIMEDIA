import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const YEAR_LEVEL_OPTIONS: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];

interface SectionYearTargetPickerProps {
  yearLevels: number[];
  onYearLevelsChange: (levels: number[]) => void;
  sections: string[];
  onSectionsChange: (sections: string[]) => void;
  sectionInput: string;
  onSectionInputChange: (value: string) => void;
}

/**
 * Lets an instructor pick which of their sections/year levels a piece of content
 * (unit, lesson, laboratory, quiz) should be visible to. Leaving both empty means
 * "visible to all of my sections and year levels" (the previous default behavior).
 */
export function SectionYearTargetPicker({
  yearLevels,
  onYearLevelsChange,
  sections,
  onSectionsChange,
  sectionInput,
  onSectionInputChange,
}: SectionYearTargetPickerProps) {
  const toggleYear = (level: number) => {
    onYearLevelsChange(
      yearLevels.includes(level) ? yearLevels.filter((l) => l !== level) : [...yearLevels, level].sort()
    );
  };

  const addSection = () => {
    const trimmed = sectionInput.trim();
    if (!trimmed) return;
    if (!sections.includes(trimmed)) onSectionsChange([...sections, trimmed]);
    onSectionInputChange('');
  };

  const removeSection = (value: string) => {
    onSectionsChange(sections.filter((s) => s !== value));
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="space-y-2">
        <Label className="text-slate-300 text-sm">Visible to year levels (leave blank for all you teach)</Label>
        <div className="grid grid-cols-4 gap-2">
          {YEAR_LEVEL_OPTIONS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={yearLevels.includes(level)}
              onClick={() => toggleYear(level)}
              className={`h-9 rounded-md border text-sm font-medium transition-all ${
                yearLevels.includes(level)
                  ? 'border-violet-500/60 bg-violet-500/10 text-white'
                  : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              Year {level}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300 text-sm">Visible to sections (leave blank for all you teach)</Label>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="e.g. A, then press Enter"
            value={sectionInput}
            onChange={(e) => onSectionInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addSection();
              }
            }}
            maxLength={50}
            className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 h-9"
          />
          <button
            type="button"
            onClick={addSection}
            className="shrink-0 rounded-md border border-slate-700 bg-slate-800/40 px-3 text-sm text-slate-200 hover:bg-slate-800/70"
          >
            Add
          </button>
        </div>
        {sections.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {sections.map((s) => (
              <span
                key={s}
                className="flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-200"
              >
                {s}
                <button type="button" onClick={() => removeSection(s)} aria-label={`Remove section ${s}`} className="text-violet-300 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
