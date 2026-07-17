import SectionWrapper from "./shared/SectionWrapper";
import { BarChart3, MapPin, Users, ShieldCheck } from "lucide-react";

type StatCardProps = {
  icon: React.ReactNode;
  number: string;
  label: string;
};

const StatCard = ({ icon, number, label }: StatCardProps) => {
  return (
    <div className="homepage-card p-8 text-center h-full">
      <div className="flex justify-center mb-4">
        <div className="icon-circle">
          {icon}
        </div>
      </div>
      <div className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
        {number}
      </div>
      <div className="text-gray-600 font-medium">
        {label}
      </div>
    </div>
  );
};

const PlatformImpactSection = () => {
  return (
    <SectionWrapper className="bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Trusted by communities nationwide
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Our platform processes thousands of crime reports daily, helping citizens and law enforcement work together for safer communities.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={<MapPin className="w-6 h-6 text-white" />}
            number="25,000+"
            label="Crime Reports"
          />
          <StatCard
            icon={<Users className="w-6 h-6 text-white" />}
            number="120+"
            label="Areas Covered"
          />
          <StatCard
            icon={<BarChart3 className="w-6 h-6 text-white" />}
            number="300+"
            label="Daily Active Users"
          />
          <StatCard
            icon={<ShieldCheck className="w-6 h-6 text-white" />}
            number="98%"
            label="Verified Reports"
          />
        </div>
      </div>
    </SectionWrapper>
  );
};

export default PlatformImpactSection;
