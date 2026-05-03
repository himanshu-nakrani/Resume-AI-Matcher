import React from 'react';
import { Home, BarChart2, Bell, FileText, Briefcase, Zap, CheckCircle2, Phone, Users, FileCheck } from 'lucide-react';

export function Obsidian() {
  return (
    <div className="flex h-screen w-full bg-[#0f1117] text-gray-300 font-sans selection:bg-cyan-500/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800/60 bg-[#0d1117] flex flex-col justify-between hidden md:flex">
        <div>
          <div className="h-16 flex items-center px-6 border-b border-gray-800/60">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold tracking-wide">
              <Zap size={20} className="fill-cyan-400/20" />
              <span>OptiMatch</span>
            </div>
          </div>
          <nav className="p-4 space-y-1">
            <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md bg-cyan-950/20 text-cyan-400 font-medium text-sm border-l-2 border-cyan-400 transition-colors">
              <Home size={18} />
              Home
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-800/50 text-gray-400 hover:text-gray-200 font-medium text-sm transition-colors border-l-2 border-transparent">
              <BarChart2 size={18} />
              Analyses
            </a>
          </nav>
        </div>
        <div className="p-4 border-t border-gray-800/60">
          <button className="flex items-center gap-3 px-3 py-2 w-full rounded-md hover:bg-gray-800/50 text-gray-400 hover:text-gray-200 font-medium text-sm transition-colors relative">
            <Bell size={18} />
            Notifications
            <span className="absolute right-3 top-2.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 flex items-center justify-between px-8 border-b border-gray-800/60 bg-[#0f1117]/80 backdrop-blur-md sticky top-0 z-10">
          <h1 className="text-xl font-semibold text-gray-100">Overview</h1>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700 text-sm font-medium text-cyan-400">
              JD
            </div>
          </div>
        </header>

        <div className="p-8 max-w-5xl mx-auto space-y-8">
          {/* Welcome Message */}
          <section>
            <h2 className="text-2xl font-bold text-white tracking-tight">Ready for your next role?</h2>
            <p className="text-gray-400 mt-1 font-mono text-sm">Analyze your resume against job requirements to find your precise match score.</p>
          </section>

          {/* Job Analysis Form */}
          <section className="bg-[#111827] border border-gray-800/80 rounded-xl p-6 shadow-sm shadow-cyan-900/5">
            <div className="flex items-center gap-2 mb-6 text-gray-200">
              <Briefcase size={18} className="text-cyan-400" />
              <h3 className="font-semibold">New Job Analysis</h3>
            </div>
            
            <form className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-gray-400 uppercase tracking-wider">Job Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Senior Frontend Engineer" 
                    className="w-full bg-[#0d1117] border border-gray-700/80 rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-gray-400 uppercase tracking-wider">Company</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Vercel" 
                    className="w-full bg-[#0d1117] border border-gray-700/80 rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={14} /> Resume Text
                  </label>
                  <textarea 
                    rows={6}
                    placeholder="Paste your resume content here..." 
                    className="w-full bg-[#0d1117] border border-gray-700/80 rounded-lg px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all resize-none font-mono text-xs"
                  ></textarea>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={14} /> Job Description
                  </label>
                  <textarea 
                    rows={6}
                    placeholder="Paste the job description here..." 
                    className="w-full bg-[#0d1117] border border-gray-700/80 rounded-lg px-4 py-3 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all resize-none font-mono text-xs"
                  ></textarea>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button 
                  type="button" 
                  className="bg-cyan-500 hover:bg-cyan-400 text-[#0f1117] font-semibold py-2.5 px-6 rounded-lg shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all flex items-center gap-2 text-sm"
                >
                  <Zap size={16} className="fill-[#0f1117]" />
                  Analyze Fit
                </button>
              </div>
            </form>
          </section>

          {/* Funnel Widget */}
          <section>
            <h3 className="text-sm font-medium text-gray-400 mb-4 tracking-wide">PIPELINE METRICS</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Applied', count: 12, icon: FileText, color: 'text-gray-300' },
                { label: 'Phone Screen', count: 4, icon: Phone, color: 'text-blue-400' },
                { label: 'Interview', count: 2, icon: Users, color: 'text-purple-400' },
                { label: 'Offer', count: 1, icon: FileCheck, color: 'text-cyan-400' }
              ].map((stage, i) => (
                <div key={stage.label} className="bg-[#111827] border border-gray-800/60 rounded-xl p-4 flex flex-col gap-3 group hover:border-gray-700 transition-colors">
                  <div className="flex items-center justify-between">
                    <stage.icon size={18} className={stage.color} />
                    <span className="text-2xl font-bold text-white font-mono">{stage.count}</span>
                  </div>
                  <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">{stage.label}</div>
                  <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-current opacity-50 rounded-full" style={{ width: `${(stage.count / 12) * 100}%`, color: 'var(--tw-text-opacity, 1)' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
