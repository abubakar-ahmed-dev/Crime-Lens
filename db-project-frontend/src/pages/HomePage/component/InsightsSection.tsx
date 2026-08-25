import SectionWrapper from "./shared/SectionWrapper";
import { TrendingUp, BarChart3, MapPin, Calendar } from "lucide-react";

type InsightCardProps = {
  icon: React.ReactNode;
  question: string;
  answer: string;
  className?: string;
};

const InsightCard = ({ icon, question, answer, className = "" }: InsightCardProps) => {
  return (
    <div className={`homepage-card p-8 bg-white ${className}`}>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-shrink-0">
          <div className="icon-circle-border">
            {icon}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{question}</h3>
          <div className="flex items-center gap-2 text-[#237E54]">
            <span className="font-medium">{answer}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const InsightsSection = () => {
  return (
    <SectionWrapper className="bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Questions CrimeLens answers
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Turn raw data into actionable intelligence
          </p>
        </div>

        {/* Asymmetric Grid with Dashboard-Style Layout */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* First Row - Large Feature Card */}
          <div className="md:col-span-2">
            <div className="homepage-card p-8 bg-gradient-to-br from-green-50 to-white">
              <div className="flex items-center gap-6">
                <div className="flex-shrink-0">
                  <div className="icon-circle">
                    <TrendingUp className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Where is crime increasing?
                  </h3>
                  <p className="text-gray-600">
                    Identify hotspots and emerging areas of concern in real time.
                  </p>
                </div>
                
              </div>
            </div>
          </div>

          {/* Second Row - Two Cards */}
          <div className="md:col-span-1">
            <InsightCard
              icon={<BarChart3 className="w-6 h-6 text-[#237E54]" />}
              question="Which crimes are most common?"
              answer="See category-wise breakdowns and compare regions."
            />
          </div>
          <div className="md:col-span-1">
            <InsightCard
              icon={<Calendar className="w-6 h-6 text-[#237E54]" />}
              question="How has crime changed over time?"
              answer="Track historical trends and measure changes over time."
            />
          </div>

          {/* Third Row - Single Wide Card */}
          <div className="md:col-span-2">
            <div className="homepage-card p-8 bg-gradient-to-br from-green-50 to-white">
              <div className="flex items-center gap-6">
                <div className="flex-shrink-0">
                  <div className="icon-circle">
                    <MapPin className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Which neighborhoods need attention?
                  </h3>
                  <p className="text-gray-600">
                    Prioritize resources and interventions where they're needed most.
                  </p>
                </div>
                
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};

export default InsightsSection;
