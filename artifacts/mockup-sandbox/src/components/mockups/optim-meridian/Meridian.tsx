import React, { useState } from "react";
import { 
  Briefcase, 
  LayoutDashboard, 
  Bell, 
  Search,
  Settings,
  User,
  ChevronRight,
  UploadCloud,
  FileText
} from "lucide-react";

export function Meridian() {
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] font-sans text-slate-900" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between">
        <div>
          <div className="h-16 flex items-center px-6 border-b border-slate-100">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-xl tracking-tight">
              <Briefcase className="w-6 h-6" />
              <span>OptiMatch</span>
            </div>
          </div>
          <nav className="p-4 space-y-1">
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-blue-700 bg-blue-50/50 border-l-2 border-blue-600 transition-colors">
              <LayoutDashboard className="w-5 h-5 text-blue-600" />
              Home
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-l-2 border-transparent transition-colors">
              <Search className="w-5 h-5 text-slate-400" />
              Analyses
            </a>
          </nav>
        </div>
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
              <div className="relative">
                <Bell className="w-5 h-5 text-slate-400" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              </div>
              Notifications
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              JD
            </div>
            <div className="text-sm">
              <p className="font-medium text-slate-900">Jane Doe</p>
              <p className="text-xs text-slate-500">Free Plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 px-8 flex items-center justify-between border-b border-slate-200 bg-white">
          <h1 className="text-lg font-semibold text-slate-800">Dashboard</h1>
          <div className="flex items-center gap-4">
            <button className="text-slate-400 hover:text-slate-600">
              <Settings className="w-5 h-5" />
            </button>
            <button className="text-slate-400 hover:text-slate-600">
              <User className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-8 py-8 space-y-8">
          {/* Welcome */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Welcome back, Jane.</h2>
            <p className="text-sm text-slate-500 mt-1">Ready to find your next role? Paste a job description below to get started.</p>
          </div>

          {/* Analysis Form */}
          <section className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-semibold text-slate-800">New Job Analysis</h3>
            </div>
            <form onSubmit={handleAnalyze} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="jobTitle" className="block text-sm font-medium text-slate-700">Job Title</label>
                  <input
                    id="jobTitle"
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Senior Product Designer"
                    className="w-full px-3 py-2 border border-slate-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="company" className="block text-sm font-medium text-slate-700">Company</label>
                  <input
                    id="company"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full px-3 py-2 border border-slate-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-shadow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="resume" className="block text-sm font-medium text-slate-700">Your Resume</label>
                  <div className="relative">
                    <textarea
                      id="resume"
                      rows={8}
                      value={resume}
                      onChange={(e) => setResume(e.target.value)}
                      placeholder="Paste your resume text here..."
                      className="w-full px-3 py-2 border border-slate-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm resize-none transition-shadow"
                    />
                    <div className="absolute bottom-3 right-3 text-slate-400 pointer-events-none">
                      <FileText className="w-5 h-5 opacity-50" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="jobDescription" className="block text-sm font-medium text-slate-700">Job Description</label>
                  <div className="relative">
                    <textarea
                      id="jobDescription"
                      rows={8}
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Paste the target job description here..."
                      className="w-full px-3 py-2 border border-slate-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm resize-none transition-shadow"
                    />
                    <div className="absolute bottom-3 right-3 text-slate-400 pointer-events-none">
                      <FileText className="w-5 h-5 opacity-50" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <UploadCloud className="w-4 h-4" />
                  Analyze Fit
                </button>
              </div>
            </form>
          </section>

          {/* Funnel Widget */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Your Pipeline</h3>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Applied", count: 24 },
                { label: "Phone Screen", count: 6 },
                { label: "Interview", count: 3 },
                { label: "Offer", count: 1 },
              ].map((stage) => (
                <div key={stage.label} className="bg-white p-5 rounded border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">{stage.label}</p>
                    <p className="text-3xl font-bold text-blue-600 mt-1">{stage.count}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
