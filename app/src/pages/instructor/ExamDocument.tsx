import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/authFetch';

interface ExamQuestion {
  id?: string | number;
  text?: string;
  title?: string;
  type?: string;
  options?: Array<string | { text?: string }>;
  correctAnswer?: string;
  points?: number;
}

interface ExamRecord {
  title: string;
  description?: string;
  type?: string;
  quiz_category?: string;
  questions_data?: ExamQuestion[];
}

const optionLetters = ['A', 'B', 'C', 'D'];

function questionText(question: ExamQuestion) {
  return question.text || question.title || 'Question';
}

function optionText(option: string | { text?: string }) {
  return typeof option === 'string' ? option : option.text || '';
}

function isMultipleChoice(question: ExamQuestion) {
  return question.type === 'multiple-choice' || (question.options?.length || 0) > 0;
}

export function ExamDocument() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const answerKey = searchParams.get('mode') === 'answer-key';
  const [exam, setExam] = useState<ExamRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadExam = async () => {
      try {
        const response = await authFetch(`http://localhost:3001/api/assessments/${id}`);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error?.message || 'Unable to load exam');
        setExam(data.data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load exam');
      } finally {
        setLoading(false);
      }
    };
    loadExam();
  }, [id]);

  const questions = useMemo(() => Array.isArray(exam?.questions_data) ? exam.questions_data : [], [exam]);

  const downloadPdf = () => {
    if (!exam) return;
    const pdf = new jsPDF({ unit: 'pt', format: 'letter' });
    const margin = 48;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let y = margin;

    const addLine = (text: string, size = 11, bold = false) => {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(text, pageWidth - margin * 2) as string[];
      for (const line of lines) {
        if (y > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += size + 6;
      }
    };

    addLine(exam.title, 18, true);
    addLine(answerKey ? 'Answer Key' : 'Exam Paper', 12, true);
    if (exam.description) addLine(exam.description, 10);
    y += 8;

    questions.forEach((question, index) => {
      addLine(`${index + 1}. ${questionText(question)}`, 11, true);
      if (isMultipleChoice(question)) {
        (question.options || []).forEach((option, optionIndex) => {
          addLine(`${optionLetters[optionIndex] || String(optionIndex + 1)}. ${optionText(option)}`, 10);
        });
      } else if (question.type === 'true-false') {
        addLine('A. True    B. False', 10);
      } else if (!answerKey) {
        addLine('Answer: _______________________________________________', 10);
      }
      if (answerKey) addLine(`Answer: ${question.correctAnswer || 'Not provided'} (${question.points || 0} point${question.points === 1 ? '' : 's'})`, 10);
      y += 8;
    });

    const filename = `${exam.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-${answerKey ? 'answer-key' : 'exam'}.pdf`;
    pdf.save(filename || 'exam.pdf');
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300"><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading exam...</div>;
  if (error || !exam) return <div className="min-h-screen bg-slate-950 p-8 text-red-300">{error || 'Exam not found'}</div>;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/instructor/quizzes')} className="text-slate-300 hover:text-white"><ArrowLeft className="w-4 h-4 mr-2" />Back to quizzes</Button>
          <Button onClick={downloadPdf} className="bg-violet-600 hover:bg-violet-700"><Download className="w-4 h-4 mr-2" />Download PDF</Button>
        </div>
        <div className="bg-white text-slate-900 rounded-xl p-8 shadow-xl">
          <h1 className="text-2xl font-bold">{exam.title}</h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-slate-500">{answerKey ? 'Answer Key' : 'Exam Paper'}</p>
          {exam.description && <p className="mt-4 text-slate-600">{exam.description}</p>}
          <div className="mt-6 space-y-6">
            {questions.map((question, index) => (
              <section key={String(question.id || index)} className="border-b border-slate-200 pb-5">
                <h2 className="font-semibold">{index + 1}. {questionText(question)}</h2>
                {isMultipleChoice(question) && <div className="mt-2 space-y-1 pl-4">{(question.options || []).map((option, optionIndex) => <p key={optionIndex}>{optionLetters[optionIndex] || optionIndex + 1}. {optionText(option)}</p>)}</div>}
                {question.type === 'true-false' && <p className="mt-2 pl-4">A. True &nbsp;&nbsp; B. False</p>}
                {!answerKey && !isMultipleChoice(question) && question.type !== 'true-false' && <p className="mt-3 text-slate-500">Answer: __________________________________________</p>}
                {answerKey && <p className="mt-2 font-semibold text-emerald-700">Answer: {question.correctAnswer || 'Not provided'} ({question.points || 0} point{question.points === 1 ? '' : 's'})</p>}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
