import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, PenTool } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useThemeStore } from '@/stores/themeStore';

export function QuizMethodPicker() {
  const navigate = useNavigate();
  const theme = useThemeStore((state) => state.theme);
  const isLightMode = theme === 'light';

  const shellClass = isLightMode
    ? 'min-h-screen bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 p-6'
    : 'min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6';
  const headingTextClass = isLightMode ? 'text-slate-900' : 'text-white';
  const secondaryTextClass = isLightMode ? 'text-slate-600' : 'text-slate-400';
  const cardClass = isLightMode
    ? 'bg-white/80 border-2 border-slate-200 hover:border-violet-500 rounded-2xl p-8 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/20'
    : 'bg-slate-900/60 border-2 border-slate-800 hover:border-violet-500 rounded-2xl p-8 transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/20';
  const infoCardClass = isLightMode
    ? 'mt-12 bg-white/70 border border-slate-200 rounded-xl p-6'
    : 'mt-12 bg-slate-900/40 border border-slate-700 rounded-xl p-6';
  const sectionTextClass = isLightMode ? 'text-slate-700' : 'text-slate-300';

  return (
    <div className={shellClass}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-violet-400 hover:text-violet-300 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="mb-12">
          <h1 className={`text-4xl font-bold ${headingTextClass}`}>Create a Quiz</h1>
          <p className={`mt-2 ${secondaryTextClass}`}>Choose how you'd like to create your quiz</p>
        </div>

        {/* Two Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Option 1: Manual Creation */}
          <div className={cardClass}>
            <div className="flex items-center justify-center w-14 h-14 bg-blue-500/20 rounded-xl mb-6">
              <PenTool className="w-8 h-8 text-blue-400" />
            </div>

            <h2 className={`text-2xl font-bold mb-3 ${headingTextClass}`}>Create Your Own</h2>
            <p className={`mb-6 ${sectionTextClass}`}>
              Manually design your quiz from scratch. Add custom questions, options, and set points for each question.
            </p>

            <div className="space-y-3 mb-8">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-400/30 flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                </div>
                <span className={sectionTextClass}>Full control over questions</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-400/30 flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                </div>
                <span className={sectionTextClass}>Multiple choice, short answer, essay</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-400/30 flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                </div>
                <span className={sectionTextClass}>Customize point values</span>
              </div>
            </div>

            <Button
              onClick={() => navigate('/instructor/quiz/create-manual')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base"
            >
              Create Manual Quiz
            </Button>
          </div>

          {/* Option 2: Auto-Generation */}
          <div className={cardClass}>
            <div className="flex items-center justify-center w-14 h-14 bg-purple-500/20 rounded-xl mb-6">
              <Zap className="w-8 h-8 text-purple-400" />
            </div>

            <h2 className={`text-2xl font-bold mb-3 ${headingTextClass}`}>Auto-Generate</h2>
            <p className={`mb-6 ${sectionTextClass}`}>
              The system automatically generates quiz questions based on the content from your selected unit and lessons.
            </p>

            <div className="space-y-3 mb-8">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-400/30 flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                </div>
                <span className={sectionTextClass}>Questions from lesson content</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-400/30 flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                </div>
                <span className={sectionTextClass}>Save time and effort</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-purple-400/30 flex items-center justify-center mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                </div>
                <span className={sectionTextClass}>Edit after generation</span>
              </div>
            </div>

            <Button
              onClick={() => navigate('/instructor/quiz/create-auto')}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white h-12 text-base"
            >
              Auto-Generate Quiz
            </Button>
          </div>
        </div>

        {/* Info Card */}
        <div className={infoCardClass}>
          <p className={`text-center ${sectionTextClass}`}>
            <span className="text-violet-400 font-semibold">Tip:</span> You can edit your quiz after creation regardless of which method you choose.
          </p>
        </div>
      </div>
    </div>
  );
}
