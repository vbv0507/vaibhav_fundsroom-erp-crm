interface PlaceholderPageProps {
  title: string;
  icon: string;
  description: string;
}

export default function PlaceholderPage({ title, icon, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
        <div className="text-5xl mb-4">{icon}</div>
        <h3 className="text-slate-700 font-medium mb-2">{title} Module</h3>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">{description}</p>
      </div>
    </div>
  );
}
