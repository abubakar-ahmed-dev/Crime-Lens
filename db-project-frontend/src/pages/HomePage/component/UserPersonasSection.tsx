import SectionWrapper from "./shared/SectionWrapper";
import { Users, Shield, Search, ArrowRight } from "lucide-react";

type PersonaCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  linkText: string;
  href: string;
};

const PersonaCard = ({ icon, title, description, linkText, href }: PersonaCardProps) => {
  return (
    <div className="homepage-card p-10 h-full group">
      <div className="flex justify-center mb-6">
        <div className="icon-circle">
          {icon}
        </div>
      </div>
      <h3 className="text-2xl font-semibold text-gray-900 mb-4 text-center">{title}</h3>
      <p className="text-gray-600 leading-relaxed mb-6 text-center flex-1">{description}</p>
      <div className="text-center">
        <a
          href={href}
          className="inline-flex items-center text-[#237E54] font-semibold group-hover:text-[#145332] transition-colors"
        >
          {linkText}
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </a>
      </div>
    </div>
  );
};

const UserPersonasSection = () => {
  return (
    <SectionWrapper className="bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-100 mb-6">
            <span className="text-sm font-bold text-[#145332]">WHO USES CRIMELENS</span>
          </div>
          <h2 className="text-[40px] md:text-[42px] font-bold text-gray-900 mb-6">
            Built For Everyone Working Towards Safer Communities
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <PersonaCard
            icon={<Users className="w-8 h-8 text-white" />}
            title="For Citizens"
            description="Stay informed about what's happening in your area. Report incidents, explore data, and build a safer community."
            linkText="Get started"
            href="/register"
          />
          <PersonaCard
            icon={<Shield className="w-8 h-8 text-white" />}
            title="For Police Departments"
            description="Investigate effectively, monitor trends, allocate resources, and improve public safety with data-driven insights."
            linkText="Learn more"
            href="/login"
          />
          <PersonaCard
            icon={<Search className="w-8 h-8 text-white" />}
            title="For Researchers"
            description="Access structured crime data for analysis, studies, and building a better understanding of crime patterns."
            linkText="Explore data"
            href="/statistics"
          />
        </div>
      </div>
    </SectionWrapper>
  );
};

export default UserPersonasSection;
