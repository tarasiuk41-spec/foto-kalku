onFocus={e => { if (parseFloat(e.target.value) === 0 || value === 0) e.target.select(); }}
          step={step} 
          placeholder="0"
          className={cn(
            "w-full border rounded-xl px-4 py-3 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold placeholder:text-slate-300",
            theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
          )} 
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[9px] font-black uppercase group-focus-within:text-emerald-500">{unit}</div>
      </div>
    </div>
  );
}

function TableRow({ label, value, unit, theme, valueColor = 'text-slate-700' }: any) {
  return (
    <tr className={cn("transition-colors border-b last:border-0", theme === 'dark' ? "hover:bg-slate-800/50 border-slate-800" : "hover:bg-slate-50 border-slate-100")}>
      <td className="px-8 py-4 font-medium text-slate-500 text-xs">{label}</td>
      <td className={cn("px-8 py-4 text-right font-bold text-base", valueColor)}>{value}</td>
      <td className="px-8 py-4 text-right text-slate-400 text-[9px] font-black uppercase">{unit}</td>
    </tr>
  );
}

function MetricCard({ title, value, subValue, description, trend, theme, color = 'blue' }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn(
      "rounded-3xl border p-8 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-500",
      theme === 'dark' ? "bg-slate-900 border-slate-800 hover:border-emerald-500/30" : "bg-white border-slate-100 hover:border-emerald-100"
    )}>
      <div className={cn("absolute -right-8 -top-8 w-24 h-24 blur-3xl opacity-10 rounded-full", color === 'emerald' ? "bg-emerald-500" : "bg-blue-500")} />
      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">{title}{trend === 'up' ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}</h4>
      <div className={cn("text-4xl font-black font-mono tracking-tighter mb-1", color === 'emerald' ? "text-emerald-600" : (theme === 'dark' ? "text-blue-400" : "text-blue-600"))}>{value}</div>
      <div className="text-[10px] font-mono text-slate-400 font-bold">{subValue}</div>
      <p className="text-[10px] text-slate-400 mt-6 leading-relaxed">{description}</p>
    </motion.div>
  );
}

interface MetricInfoTooltipProps {
  title: string;
  meaning: string;
  formula: string;
  unit?: string;
  theme: 'light' | 'dark';
  align?: 'left' | 'center' | 'right';
}

function MetricInfoTooltip({ title, meaning, formula, unit, theme, align = 'left' }: MetricInfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div 
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(prev => !prev);
        }}
        aria-label={`Informacja: ${title}`}
        className={cn(
          "w-4 h-4 rounded-full flex items-center justify-center transition-all cursor-pointer focus:outline-none ring-1",
          theme === 'dark' 
            ? "bg-slate-800/80 ring-slate-700/80 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 hover:ring-emerald-500/50" 
            : "bg-slate-100 ring-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:ring-emerald-300"
        )}
      >
        <Info className="w-2.5 h-2.5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute z-50 mt-2 p-3.5 rounded-2xl border shadow-2xl backdrop-blur-md w-72 text-left pointer-events-auto",
              "top-full",
              align === 'right' ? "right-0" : (align === 'center' ? "left-1/2 -translate-x-1/2" : "left-0"),
              theme === 'dark'
                ? "bg-slate-950/95 border-slate-800 text-slate-200 shadow-black/80"
                : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-900/15"
            )}
          >
            {/* Arrow */}
            <div 
              className={cn(
                "absolute -top-1.5 w-3 h-3 rotate-45 border-l border-t",
                align === 'right' ? "right-3" : (align === 'center' ? "left-1/2 -translate-x-1/2" : "left-2.5"),
                theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
              )} 
            />

            <div className="relative z-10 space-y-2">
              <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-800/80">
                <span className="font-bold text-xs tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {title}
                </span>
                {unit && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {unit}
                  </span>
                )}
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Co oznacza?</p>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {meaning}
                </p>
              </div>

              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Jak jest obliczana?</p>
                <p className="text-[11px] font-mono leading-relaxed text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/15">
                  {formula}
                </p>
              </div>
            </div>
          </motion.div>
        )}
