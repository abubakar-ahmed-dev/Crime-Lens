import SectionWrapper from "./shared/SectionWrapper";
import InteractiveMap from "../../../assets/homepage/interactive-map.webp";
import { Check, MapPin, Filter, Layers, ArrowRight } from "lucide-react";

const MapShowcaseSection = () => {
  return (
    <SectionWrapper className="bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

          {/* Left Side - Content */}
          <div className="flex-1 space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-100 mb-6">
                <MapPin className="w-4 h-4 text-[#237E54]" />
                <span className="text-sm font-medium text-[#145332]">Interactive Map</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
                Explore crime geographically.
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                Visualize crime patterns across your city with an interactive map. Filter, search, and analyze data in real-time.
              </p>
            </div>

            {/* Features List */}
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-[#237E54]" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Clustered crime markers</div>
                  <div className="text-gray-600">See patterns at a glance with smart clustering</div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Filter className="w-5 h-5 text-[#237E54]" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Powerful filters</div>
                  <div className="text-gray-600">Filter by crime type, zone, date range, and radius</div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-5 h-5 text-[#237E54]" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Zone boundaries</div>
                  <div className="text-gray-600">Toggle police zones and severity heatmaps</div>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-[#237E54]" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Location search</div>
                  <div className="text-gray-600">Find crimes within a specific radius</div>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => window.location.href = "/map"}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#145332] to-[#237E54] text-white font-semibold rounded-lg hover:from-[#145332] hover:to-[#145332] transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Open Interactive Map
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          {/* Right Side - Screenshot */}
          <div className="flex-1">
            <div className="screenshot-frame p-3 bg-gradient-to-br from-gray-50 to-gray-100">
              <img
                src={InteractiveMap}
                alt="Interactive Map Screenshot"
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

export default MapShowcaseSection;
