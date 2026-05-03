import React, { useState } from 'react';
import './_group.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Home, FileText, Bell, ChevronRight, Sparkles } from 'lucide-react';

export function Ember() {
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    setAnalyzing(true);
    setTimeout(() => setAnalyzing(false), 2000);
  };

  return (
    <div className="ember-theme min-h-screen flex w-full bg-[#fbf9f6] text-[#451a03]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#78350f] text-[#fef3c7] flex flex-col h-screen sticky top-0 shadow-xl rounded-r-3xl z-10">
        <div className="p-8 flex items-center gap-3 font-bold text-2xl tracking-tight text-white">
          <Sparkles className="w-6 h-6 text-[#fcd34d]" />
          OptiMatch
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#92400e] text-white font-medium transition-colors">
            <Home className="w-5 h-5" />
            Home
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-[#92400e]/50 text-[#fde68a] transition-colors">
            <FileText className="w-5 h-5" />
            Analyses
          </a>
        </nav>

        <div className="p-6">
          <a href="#" className="flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-[#92400e]/50 text-[#fde68a] transition-colors">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5" />
              Notifications
            </div>
            <Badge className="bg-[#fcd34d] text-[#78350f] hover:bg-[#fde68a] rounded-full px-2 shadow-sm border-none">3</Badge>
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 md:p-12 lg:p-16 max-w-5xl mx-auto overflow-y-auto">
        <header className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-[#451a03]">
            Let's find your next great role.
          </h1>
          <p className="text-lg text-[#78350f]/80 max-w-2xl leading-relaxed">
            Paste your resume and the job description below. We'll analyze your fit, highlight your strengths, and guide you on what to emphasize.
          </p>
        </header>

        {/* Funnel Widget */}
        <section className="mb-12">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[#92400e] mb-4">Your Pipeline</h3>
          <div className="flex flex-wrap gap-4">
            {[
              { label: 'Applied', count: 12, color: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]' },
              { label: 'Phone Screen', count: 4, color: 'bg-[#ffedd5] text-[#c2410c] border-[#fed7aa]' },
              { label: 'Interview', count: 2, color: 'bg-[#ffedd5] text-[#b45309] border-[#fcd34d]' },
              { label: 'Offer', count: 1, color: 'bg-[#ecfccb] text-[#3f6212] border-[#d9f99d]' },
            ].map((stage, i) => (
              <div key={stage.label} className="flex items-center">
                <div className={`px-5 py-2.5 rounded-full border shadow-sm flex items-center gap-3 ${stage.color} font-medium`}>
                  <span>{stage.label}</span>
                  <span className="bg-white/50 px-2 py-0.5 rounded-full text-sm font-bold">{stage.count}</span>
                </div>
                {i < 3 && <ChevronRight className="w-5 h-5 mx-2 text-[#d97706]/40" />}
              </div>
            ))}
          </div>
        </section>

        {/* Analysis Form */}
        <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#fef3c7]">
          <form onSubmit={handleAnalyze} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label htmlFor="jobTitle" className="text-base font-semibold text-[#451a03]">Job Title</Label>
                <Input 
                  id="jobTitle" 
                  placeholder="e.g. Senior Product Designer" 
                  className="rounded-xl border-[#fde68a] bg-[#fbf9f6] focus-visible:ring-[#d97706] h-12 text-lg px-4"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="company" className="text-base font-semibold text-[#451a03]">Company</Label>
                <Input 
                  id="company" 
                  placeholder="e.g. Acme Corp" 
                  className="rounded-xl border-[#fde68a] bg-[#fbf9f6] focus-visible:ring-[#d97706] h-12 text-lg px-4"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="resume" className="text-base font-semibold text-[#451a03] flex items-center justify-between">
                Your Resume
                <span className="text-sm font-normal text-[#92400e]">Paste text</span>
              </Label>
              <Textarea 
                id="resume" 
                placeholder="Paste your resume content here..." 
                className="min-h-[200px] rounded-2xl border-[#fde68a] bg-[#fbf9f6] focus-visible:ring-[#d97706] p-5 text-base resize-y leading-relaxed"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="jobDesc" className="text-base font-semibold text-[#451a03]">Job Description</Label>
              <Textarea 
                id="jobDesc" 
                placeholder="Paste the target job description here..." 
                className="min-h-[200px] rounded-2xl border-[#fde68a] bg-[#fbf9f6] focus-visible:ring-[#d97706] p-5 text-base resize-y leading-relaxed"
              />
            </div>

            <div className="pt-4 flex justify-end">
              <Button 
                type="submit" 
                disabled={analyzing}
                className="bg-[#d97706] hover:bg-[#b45309] text-white rounded-full px-10 py-7 text-lg font-semibold shadow-lg shadow-[#d97706]/20 transition-all hover:shadow-[#d97706]/40 hover:-translate-y-0.5"
              >
                {analyzing ? (
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing fit...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Analyze Fit
                    <Sparkles className="w-5 h-5" />
                  </span>
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
