import SectionWrapper from "./shared/SectionWrapper";
import { Map, BarChart3, MessageSquare, Search, ArrowRight } from "lucide-react";

type FeatureCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  linkText: string;
  href: string;
};

const FeatureCard = ({ icon, title, description, linkText, href }: FeatureCardProps) => {
  return (
    <div className="homepage-card p-8 group cursor-pointer">
      <div className="flex justify-center mb-6">
        <div className="icon-circle">
          {icon}
        </div>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-3 text-center">{title}</h3>
      <p className="text-gray-600 leading-relaxed mb-6 text-center">{description}</p>
      <a
        href={href}
        className="inline-flex items-center justify-center w-full text-[#237E54] font-medium group-hover:text-[#145332] transition-colors"
      >
        {linkText}
        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
      </a>
    </div>
  );
};

const CoreFeaturesSection = () => {
  return (
    <SectionWrapper className="bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Everything you need to understand crime data
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Powerful tools designed for citizens, police departments, and researchers
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<Map className="w-7 h-7 text-white" />}
            title="Interactive Maps"
            description="Explore crime geographically with filters, zones, and real-time updates."
            linkText="Explore map"
            href="/map"
          />
          <FeatureCard
            icon={<BarChart3 className="w-7 h-7 text-white" />}
            title="Statistics Dashboard"
            description="Analyze trends, patterns, and historical crime data with visual charts."
            linkText="View statistics"
            href="/statistics"
          />
          <FeatureCard
            icon={<MessageSquare className="w-7 h-7 text-white" />}
            title="Community Reporting"
            description="Citizens can submit reports directly and track verification status."
            linkText="Report crime"
            href="/report-crime"
          />
          <FeatureCard
            icon={<Search className="w-7 h-7 text-white" />}
            title="Advanced Search"
            description="Filter by crime type, location, date range, and more."
            linkText="Search records"
            href="/map"
          />
        </div>
      </div>
    </SectionWrapper>
  );
};

export default CoreFeaturesSection;
