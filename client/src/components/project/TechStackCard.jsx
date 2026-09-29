// client/src/components/project/TechStackCard.jsx


export default function TechStackCard({ project }) {
  const techStack = project?.techStack || {};
  const languages = techStack.languages || [];
  const frameworks = techStack.frameworks || [];
  const databases = techStack.databases || [];
  const devops = techStack.devops || [];

  const hasAnyTech =
    languages.length > 0 ||
    frameworks.length > 0 ||
    databases.length > 0 ||
    devops.length > 0;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070c16]/80 p-4 backdrop-blur-md flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Technology Stack
        </h3>
        <span className="text-[10px] font-mono text-slate-500">RIE Verified</span>
      </div>

      {!hasAnyTech ? (
        <p className="text-xs text-slate-600 font-mono italic">No framework or tech stack metadata detected.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Frameworks */}
          {frameworks.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
                Frameworks & Libraries
              </span>
              <div className="flex flex-wrap gap-1.5">
                {frameworks.map((fw) => (
                  <span
                    key={fw}
                    className="px-2.5 py-1 rounded-md text-xs font-medium border bg-cyan-500/10 text-cyan-300 border-cyan-500/25"
                  >
                    {fw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Databases & Storage */}
          {databases.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
                Databases & ORM
              </span>
              <div className="flex flex-wrap gap-1.5">
                {databases.map((db) => (
                  <span
                    key={db}
                    className="px-2.5 py-1 rounded-md text-xs font-medium border bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                  >
                    {db}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* DevOps & Infrastructure */}
          {devops.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
                DevOps & Infrastructure
              </span>
              <div className="flex flex-wrap gap-1.5">
                {devops.map((d) => (
                  <span
                    key={d}
                    className="px-2.5 py-1 rounded-md text-xs font-medium border bg-amber-500/10 text-amber-300 border-amber-500/25"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Languages */}
          {languages.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
                Programming Languages
              </span>
              <div className="flex flex-wrap gap-1.5">
                {languages.map((lang) => (
                  <span
                    key={lang}
                    className="px-2 py-0.5 rounded text-xs font-mono border bg-white/[0.03] text-slate-300 border-white/[0.08]"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
