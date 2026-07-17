import SectionWrapper from "./shared/SectionWrapper";
import { Database, Map, TrendingUp, Shield, ArrowRight } from "lucide-react";

const WhyCrimeLensSection = () => {
  return (
    <SectionWrapper className="bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

          {/* Left Side - Problem Statement */}
          <div className="flex-1">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
              Crime data is everywhere.
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#145332] to-[#237E54]">
                Insights are not.
              </span>
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed max-w-xl mb-8">
              Crime information is often fragmented across multiple sources, difficult to analyze, and hard to access for the people who need it most.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed max-w-xl">
              CrimeLens brings structure to chaos — transforming scattered reports into clear, interactive visualizations that help communities understand patterns and make informed decisions.
            </p>
          </div>

          {/* Right Side - Enhanced Flow Diagram */}
          <div className="flex-1">
            <div className="homepage-card p-10 bg-white">
              <div className="space-y-8">
                {/* Step 1 */}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="icon-circle-border">
                      <Database className="w-6 h-6 text-[#237E54]" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-lg mb-1">Raw Reports</div>
                    <div className="text-gray-600">Scattered crime data from multiple sources</div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-50">
                    <ArrowRight className="w-4 h-4 text-[#237E54]" />
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="icon-circle-border">
                      <Shield className="w-6 h-6 text-[#237E54]" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-lg mb-1">Structured Database</div>
                    <div className="text-gray-600">Verified, organized, and validated records</div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-50">
                    <ArrowRight className="w-4 h-4 text-[#237E54]" />
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="icon-circle-border">
                      <Map className="w-6 h-6 text-[#237E54]" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-lg mb-1">Interactive Maps</div>
                        <div className="text-gray-600">Geographic visualization and clustering</div>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-50">
                    <ArrowRight className="w-4 h-4 text-[#237E54]" />
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="icon-circle">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-lg mb-1">Actionable Insights</div>
                    <div className="text-gray-600">Data-driven decisions for safer communities</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </SectionWrapper>
  );
};

export default WhyCrimeLensSection;
