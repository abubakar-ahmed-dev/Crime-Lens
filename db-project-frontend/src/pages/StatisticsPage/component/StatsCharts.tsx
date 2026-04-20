import { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { API_BASE_URL } from "../../../config/constants";

const COLORS = [
  "#1E90FF", "#FF6347", "#32CD32", "#FFD700", "#8A2BE2",
  "#FF1493", "#00CED1", "#FF4500", "#9370DB", "#20B2AA",
  "#FF69B4", "#4169E1", "#F08080", "#90EE90", "#DDA0DD",
  "#87CEEB", "#FF8C00", "#9932CC", "#00FA9A", "#DC143C"
];

// ---------------------------
// Types
// ---------------------------
interface CrimeType {
  id: number;
  name: string;
}

interface PieDataItem {
  name: string;
  count: number;
}

interface BarDataItem {
  zone: string;
  crimeCount: number;
}

interface LineDataItem {
  date: string;
  crimeCount: number;
}

const StatsCharts = () => {
  // ---------------------------
  // STATES
  // ---------------------------
  const [crimeTypes, setCrimeTypes] = useState<CrimeType[]>([]);
  const [selectedCrimeType, setSelectedCrimeType] = useState("");

  const [lineData, setLineData] = useState<LineDataItem[]>([]);
  const [barData, setBarData] = useState<BarDataItem[]>([]);
  const [pieData, setPieData] = useState<PieDataItem[]>([]);

  const [startLine, setStartLine] = useState("");
  const [endLine, setEndLine] = useState("");
  const [startBar, setStartBar] = useState("");
  const [endBar, setEndBar] = useState("");
  const [startPie, setStartPie] = useState("");
  const [endPie, setEndPie] = useState("");

  // ---------------------------
  // FORMAT DATE HELPER
  // ---------------------------
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  // ---------------------------
  // CUSTOM LABEL FOR BAR CHART
  // ---------------------------
  const CustomXAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const text = payload.value;
    
    // Split long names into two lines
    if (text.length > 15) {
      const words = text.split(' ');
      const mid = Math.ceil(words.length / 2);
      const line1 = words.slice(0, mid).join(' ');
      const line2 = words.slice(mid).join(' ');
      
      return (
        <g transform={`translate(${x},${y})`}>
          <text x={0} y={0} dy={20} textAnchor="middle" fill="#666" fontSize="9">
            <tspan x={0} dy="0">{line1}</tspan>
            <tspan x={0} dy="10">{line2}</tspan>
          </text>
        </g>
      );
    }
    
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={20} textAnchor="middle" fill="#666" fontSize="9">
          {text}
        </text>
      </g>
    );
  };

  // ---------------------------
  // FETCH CRIME TYPES
  // ---------------------------
  const fetchCrimeTypes = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/stats/crime-type-distribution`);
      // extract crime types
      const types: CrimeType[] = res.data.map((item: any) => ({
        id: item.crimeTypeId,
        name: item.CrimeType.name,
      }));
      setCrimeTypes(types);
    } catch (err) {
      console.error(err);
    }
  };

  // ---------------------------
  // FETCH CHART DATA
  // ---------------------------
  const fetchLineData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/stats/crime-trend`, {
        params: { crimeTypeId: selectedCrimeType, start: startLine, end: endLine },
      });
      const formatted: LineDataItem[] = res.data.map((item: any) => ({
        date: formatDate(item.month),
        crimeCount: Number(item.count),
      }));
      setLineData(formatted);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBarData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/stats/zone-crime-count`, {
        params: { start: startBar, end: endBar },
      });
      const formatted: BarDataItem[] = res.data.map((item: any) => ({
        zone: item.Zone?.name || "Unknown",
        crimeCount: Number(item.count),
      }));
      setBarData(formatted);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPieData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/stats/crime-type-distribution`, {
        params: { start: startPie, end: endPie },
      });
      const formatted: PieDataItem[] = res.data.map((item: any) => ({
        name: item.CrimeType.name,
        count: Number(item.count),
      }));
      setPieData(formatted);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCrimeTypes();
    fetchLineData();
    fetchBarData();
    fetchPieData();
  }, []);

  // ---------------------------
  // JSX
  // ---------------------------
  return (
    <div className="flex flex-col gap-y-10">

      {/* LINE CHART */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
          <h2 className="text-lg sm:text-xl font-semibold">Crime Trend Over Time</h2>

          <div className="flex flex-wrap gap-2 sm:gap-3 items-center min-w-0">
            <select
              value={selectedCrimeType}
              onChange={(e) => setSelectedCrimeType(e.target.value)}
              className="border px-3 py-1 rounded-lg shadow-sm text-sm min-w-0 max-w-full"
            >
              <option value="">All Crime Types</option>
              {crimeTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>
                  {ct.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={startLine}
              onChange={(e) => setStartLine(e.target.value)}
              className="border px-2 sm:px-3 py-1 rounded-lg shadow-sm text-sm min-w-0"
            />
            <span className="font-semibold text-gray-600 hidden sm:inline">→</span>
            <input
              type="date"
              value={endLine}
              onChange={(e) => setEndLine(e.target.value)}
              className="border px-2 sm:px-3 py-1 rounded-lg shadow-sm text-sm min-w-0"
            />
            <button
              onClick={fetchLineData}
              className="px-4 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="4 4" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="crimeCount" stroke="#FF4500" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* BAR CHART */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-12">
          <h2 className="text-lg sm:text-xl font-semibold">Crimes per Zone</h2>

          <div className="flex flex-wrap gap-2 sm:gap-3 items-center min-w-0">
            <input
              type="date"
              value={startBar}
              onChange={(e) => setStartBar(e.target.value)}
              className="border px-3 py-1 rounded-lg shadow-sm"
            />
            <span className="font-semibold text-gray-600">→</span>
            <input
              type="date"
              value={endBar}
              onChange={(e) => setEndBar(e.target.value)}
              className="border px-3 py-1 rounded-lg shadow-sm"
            />
            <button
              onClick={fetchBarData}
              className="px-4 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={barData} margin={{ bottom: 5, left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="4 4" />
            <XAxis 
              dataKey="zone" 
              tick={<CustomXAxisTick />} 
              height={70} 
              interval={0}
              angle={0}
            />
            <YAxis />
            <Tooltip />
            <Bar dataKey="crimeCount" fill="#1E90FF" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* PIE CHART */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold mb-4">Crime Type Distribution</h2>

        <div className="flex flex-wrap gap-2 sm:gap-3 items-center mb-4 min-w-0">
          <input
            type="date"
            value={startPie}
            onChange={(e) => setStartPie(e.target.value)}
            className="border px-3 py-1 rounded-lg shadow-sm"
          />
          <span className="font-semibold text-gray-600">→</span>
          <input
            type="date"
            value={endPie}
            onChange={(e) => setEndPie(e.target.value)}
            className="border px-3 py-1 rounded-lg shadow-sm"
          />
          <button
            onClick={fetchPieData}
            className="px-4 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Apply
          </button>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={pieData as any[]} cx="50%" cy="50%" label outerRadius={110} dataKey="count">
              {pieData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Legend />
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>

      </div>

    </div>
  );
};

export default StatsCharts;
