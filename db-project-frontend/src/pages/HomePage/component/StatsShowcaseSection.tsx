import SectionWrapper from "./shared/SectionWrapper";
import StatisticsDashboard from "../../../assets/homepage/statistics-dashboard.webp";
import { TrendingUp, BarChart, PieChart, Calendar, ArrowRight } from "lucide-react";

const StatsShowcaseSection = () => {
  return (
    <SectionWrapper className="bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">

          {/* Left Side - Content */}
          <div className="flex-1 space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-100 mb-6">
                <BarChart className="w-4 h-4 text-[#237E54]" />
                <span className="text-sm font-medium text-[#145332]">Statistics Dashboard</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
                Turn crime records into meaningful insights.
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                Go beyond raw numbers. Understand trends, compare zones, and analyze historical data to make data-driven decisions.
              </p>
            </div>

            {/* Features List */}
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-lg hover:bg-white transition-colors">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-[#237E54]" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Historical trends</div>
                  <div className="text-gray-600">Track crime patterns over time</div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg hover:bg-white transition-colors">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <BarChart className="w-5 h-5 text-[#237E54]" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Type distribution</div>
                  <div className="text-gray-600">See which crimes are most common</div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg hover:bg-white transition-colors">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <PieChart className="w-5 h-5 text-[#237E54]" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Zone comparisons</div>
                  <div className="text-gray-600">Compare crime across different areas</div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg hover:bg-white transition-colors">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-[#237E54]" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Date range analysis</div>
                  <div className="text-gray-600">Analyze specific time periods</div>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => window.location.href = "/statistics"}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#145332] to-[#237E54] text-white font-semibold rounded-lg hover:from-[#145332] hover:to-[#145332] transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              View Statistics
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Right Side - Screenshot */}
          <div className="flex-1">
            <div className="screenshot-frame p-3 bg-white">
              <img
                src={StatisticsDashboard}
                alt="Statistics Dashboard Screenshot"
                className="w-full h-auto rounded-xl"
                loading="lazy"
              />
            </div>
          </div>

        </div>
      </div>
    </SectionWrapper>
  );
};

export default StatsShowcaseSection;
