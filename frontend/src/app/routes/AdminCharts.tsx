import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "@/components/ui/Card";
import { adminTrend, categoryBreakdown } from "../productData";

const colors = ["#0758d8", "#13a05f", "#f59e0b", "#ef4444", "#64748b"];

export default function AdminCharts() {
  return (
    <>
      <Panel className="h-72">
        <h2 className="mb-3 font-bold text-slate-900">Questions Over Time</h2>
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={adminTrend}>
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="verified" stroke="#0758d8" strokeWidth={3} />
            <Line type="monotone" dataKey="escalated" stroke="#f59e0b" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
      <Panel className="h-72">
        <h2 className="mb-3 font-bold text-slate-900">Questions by Category</h2>
        <ResponsiveContainer width="100%" height="85%">
          <PieChart>
            <Pie data={categoryBreakdown} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82}>
              {categoryBreakdown.map((entry, index) => <Cell key={entry.name} fill={colors[index]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Panel>
    </>
  );
}
